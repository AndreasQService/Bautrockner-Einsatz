import { v4 as uuidv4 } from 'uuid';
import { OFFLINE_STORES, openOfflineDatabase } from './db.js';
import { sha256CanonicalProjectContent } from './canonicalDigest.js';

const nowIso = () => new Date().toISOString();

function arrays(value) { return Array.isArray(value) ? value : []; }

async function sha256(blob) {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifiedBlobForTransaction(transactionId, entityId = null) {
  const db = await openOfflineDatabase();
  const [manifest, blobs, operations] = await Promise.all([
    db.get(OFFLINE_STORES.TRANSACTIONS, transactionId),
    db.getAllFromIndex(OFFLINE_STORES.BLOBS, 'by-transaction', transactionId),
    db.getAllFromIndex(OFFLINE_STORES.OUTBOX, 'by-transaction', transactionId),
  ]);
  if (!manifest?.localConfirmedAt) throw new Error(`Lokale Medientransaktion ist nicht bestätigt: ${transactionId}`);
  const expectedEntity = entityId == null ? null : String(entityId);
  const candidates = expectedEntity == null
    ? blobs
    : blobs.filter(row => String(row.entityId) === expectedEntity);
  if (candidates.length !== 1) throw new Error(`Medienzuordnung ist nicht eindeutig: ${transactionId}/${expectedEntity || '*'}`);
  const row = candidates[0];
  const operation = operations.find(item => item.blobId === row.blobId || String(item.entityId) === String(row.entityId));
  if (!operation || (expectedEntity != null && String(operation.entityId) !== expectedEntity)) {
    throw new Error(`Outbox-Medienzuordnung fehlt: ${transactionId}/${expectedEntity}`);
  }
  const declared = (manifest.blobAssociations || []).find(item => item.blobId === row.blobId);
  if (manifest.blobAssociations && (!declared || String(declared.entityId) !== String(row.entityId))) {
    throw new Error(`Manifest-Medienzuordnung stimmt nicht: ${row.blobId}`);
  }
  if (!(row.blob instanceof Blob) || !row.blob.size || row.blob.size !== row.size) throw new Error('Lokaler Medienblob ist beschädigt');
  if (!row.checksum || await sha256(row.blob) !== row.checksum) throw new Error('Lokale Medien-Prüfsumme stimmt nicht');
  return row;
}

/** Rebuilds ephemeral blob: URLs after reload from the durable transaction id.
 * Every object URL is returned so the caller can revoke it when the project closes.
 */
export async function restoreProjectOfflineMedia(snapshot, {
  createObjectURL = blob => URL.createObjectURL(blob),
  revokeObjectURL = url => URL.revokeObjectURL(url),
  loadVerifiedBlob = verifiedBlobForTransaction,
} = {}) {
  const restoredUrls = [];
  const visit = async value => {
    if (Array.isArray(value)) return Promise.all(value.map(visit));
    if (!value || typeof value !== 'object') return value;
    const copy = {};
    for (const [key, child] of Object.entries(value)) copy[key] = await visit(child);
    if (copy.offlineTransactionId) {
      const blobRow = await loadVerifiedBlob(String(copy.offlineTransactionId), copy.id || copy.entityId || null);
      const localUrl = createObjectURL(blobRow.blob);
      restoredUrls.push(localUrl);
      copy.preview = localUrl;
      if (copy.type !== 'document') copy.url = localUrl;
      copy.syncStatus = copy.syncStatus || 'local_only';
      copy.offlineRecovered = true;
    }
    return copy;
  };
  try {
    const restored = await visit(snapshot);
    for (const [field, transactionField] of [
      ['exteriorPhoto', 'exteriorPhotoOfflineTransactionId'],
      ['customMapImage', 'customMapImageOfflineTransactionId'],
      ['damageTypeImage', 'damageTypeImageOfflineTransactionId'],
    ]) {
      if (!restored?.[transactionField]) continue;
      const blobRow = await loadVerifiedBlob(String(restored[transactionField]));
      const localUrl = createObjectURL(blobRow.blob);
      restoredUrls.push(localUrl);
      restored[field] = localUrl;
    }
    return { snapshot: restored, objectUrls: restoredUrls };
  } catch (error) {
    for (const url of restoredUrls) {
      try { revokeObjectURL(url); } catch { /* preserve the admission error */ }
    }
    throw error;
  }
}

export function countProjectContent(project = {}) {
  const rooms = arrays(project.rooms);
  const measurementProtocols = arrays(project.measurementProtocols || project.measurement_protocols || project.measurements);
  const measurementRooms = arrays(project.measurementRooms);
  const measurements = measurementRooms.reduce((sum, room) => sum + arrays(room.measurements || room.points).length, 0)
    + measurementProtocols.reduce((sum, protocol) => sum + arrays(protocol.measurements || protocol.points).length, 0);
  const images = arrays(project.images).length
    + arrays(project.exteriorPhotos).length
    + arrays(project.measurementImages).length
    + (project.exteriorPhoto ? 1 : 0)
    + (project.damageTypeImage ? 1 : 0);
  const equipment = arrays(project.equipment || project.devices || project.dryingData?.equipment).length;
  const todos = arrays(project.todos || project.projectTodos || project.project_todos).length;
  const contacts = arrays(project.contacts).length;
  const materialized = project._offlineMaterialization || {};
  return {
    projects: 1,
    rooms: Math.max(rooms.length, arrays(materialized.relationalRooms).length),
    measurementRooms: measurementRooms.length,
    measurementProtocols: Math.max(measurementProtocols.length, arrays(materialized.relationalProtocols).length),
    measurements: Math.max(measurements, arrays(materialized.relationalMeasurements).length),
    images,
    equipment: Math.max(equipment, arrays(materialized.devices).length),
    todos: Math.max(todos, arrays(materialized.todos).length),
    contacts,
    documents: arrays(materialized.documents).length,
    uploadJournal: arrays(materialized.uploadJournal).length,
    storageArtifacts: arrays(materialized.storageArtifacts).length,
  };
}

export function collectProjectMediaUrls(project = {}) {
  const candidates = [project.exteriorPhoto, project.damageTypeImage];
  for (const item of [...arrays(project.images), ...arrays(project.exteriorPhotos), ...arrays(project.measurementImages)]) {
    candidates.push(item?.url, item?.preview, item?.publicUrl);
  }
  for (const room of arrays(project.measurementRooms)) {
    for (const item of arrays(room.images)) candidates.push(item?.url, item?.preview, item?.publicUrl);
  }
  return [...new Set(candidates.filter(url => typeof url === 'string' && /^https?:\/\//i.test(url)))];
}

async function fetchMediaBlobs(project, fetchFn, storageDownload = null) {
  const blobs = [];
  for (const url of collectProjectMediaUrls(project)) {
    const response = await fetchFn(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Bild konnte nicht lokal bereitgestellt werden (${response.status})`);
    const blob = await response.blob();
    if (!blob.size) throw new Error('Leere Bilddatei beim lokalen Projekt-Download');
    blobs.push({ blobId: uuidv4(), url, blob, size: blob.size, checksum: await sha256(blob), mimeType: blob.type, createdAt: nowIso() });
  }
  for (const artifact of arrays(project._offlineMaterialization?.storageArtifacts)) {
    let blob;
    let sourceKey;
    if (artifact.url) {
      const response = await fetchFn(artifact.url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Datei-Download fehlgeschlagen (${response.status}): ${artifact.url}`);
      blob = await response.blob();
      sourceKey = artifact.url;
    } else {
      if (typeof storageDownload !== 'function') throw new Error(`Storage-Datei kann nicht lokal geladen werden: ${artifact.path}`);
      blob = await storageDownload(artifact);
      sourceKey = `storage://${artifact.bucket}/${artifact.path}`;
    }
    if (!(blob instanceof Blob) || !blob.size) throw new Error(`Leere Pflichtdatei: ${sourceKey}`);
    blobs.push({ blobId: uuidv4(), url: sourceKey, blob, size: blob.size, checksum: await sha256(blob), mimeType: blob.type, entityId: artifact.entityId, kind: artifact.kind, createdAt: nowIso() });
  }
  return blobs;
}

/** Atomarer, rein lokaler Commit einer geöffneten Projektsitzung mit Readback. */
export async function createVerifiedProjectSession({ project, lockToken, baseVersion, actor, device, fetchFn = fetch, storageDownload = null }) {
  if (!project?.id) throw new Error('Projekt-ID fehlt');
  if (!lockToken) throw new Error('Bestätigtes Sperr-Token fehlt');
  const media = await fetchMediaBlobs(project, fetchFn, storageDownload);
  const counts = countProjectContent(project);
  const mediaBlobIds = media.map(item => item.blobId);
  const snapshotChecksum = await sha256CanonicalProjectContent(project);
  const row = {
    projectId: project.id,
    sessionId: uuidv4(),
    lockToken,
    actor: actor || null,
    device: device || null,
    baseVersion: Number(baseVersion || 1),
    // Monotonic client edit revision. Snapshot writers must never replace a
    // newer locally-confirmed edit merely because an older async write finishes
    // later (common on iPad around image processing / connectivity changes).
    localRevision: 0,
    state: 'offline_available',
    snapshot: project,
    snapshotChecksum,
    counts,
    media: media.map(item => ({
      blobId: item.blobId,
      url: item.url,
      size: item.size,
      checksum: item.checksum,
      mimeType: item.mimeType,
      entityId: item.entityId || null,
      kind: item.kind || 'session-media',
      createdAt: item.createdAt,
    })),
    mediaBlobIds,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const db = await openOfflineDatabase();
  const tx = db.transaction([OFFLINE_STORES.SESSIONS, OFFLINE_STORES.BLOBS], 'readwrite', { durability: 'strict' });
  await tx.objectStore(OFFLINE_STORES.SESSIONS).put(row);
  for (const item of media) {
    await tx.objectStore(OFFLINE_STORES.BLOBS).put({
      ...item, transactionId: row.sessionId, projectId: project.id, kind: item.kind || 'session-media', entityId: item.entityId || null,
    });
  }
  await tx.done;
  return verifyProjectSession(project.id, { sessionId: row.sessionId, lockToken, expectedCounts: counts });
}

export async function verifyProjectSession(projectId, { sessionId, lockToken, expectedCounts } = {}) {
  const db = await openOfflineDatabase();
  const row = await db.get(OFFLINE_STORES.SESSIONS, projectId);
  if (!row || row.state !== 'offline_available') throw new Error('Lokale Projektsitzung fehlt');
  if (sessionId && row.sessionId !== sessionId) throw new Error('Lokale Sitzungs-ID stimmt nicht');
  if (lockToken && row.lockToken !== lockToken) throw new Error('Lokales Sperr-Token stimmt nicht');
  const actualCounts = countProjectContent(row.snapshot);
  const expected = expectedCounts || row.counts;
  for (const key of Object.keys(expected)) {
    if (actualCounts[key] !== expected[key]) throw new Error(`Lokale Vollständigkeitsprüfung fehlgeschlagen: ${key}`);
  }
  if (!row.snapshotChecksum || await sha256CanonicalProjectContent(row.snapshot) !== row.snapshotChecksum) {
    throw new Error('Lokale Projekt-Prüfsumme stimmt nicht');
  }
  for (const blobId of row.mediaBlobIds || []) {
    const blobRow = await db.get(OFFLINE_STORES.BLOBS, blobId);
    if (!blobRow?.blob?.size || blobRow.blob.size !== blobRow.size) throw new Error('Lokaler Bild-Readback fehlgeschlagen');
    if (!blobRow.checksum || await sha256(blobRow.blob) !== blobRow.checksum) throw new Error('Lokale Bild-Prüfsumme stimmt nicht');
  }
  const expectedMediaUrls = collectProjectMediaUrls(row.snapshot);
  const expectedStorageArtifacts = arrays(row.snapshot?._offlineMaterialization?.storageArtifacts);
  const expectedMediaCount = expectedMediaUrls.length + expectedStorageArtifacts.length;
  if ((row.media || []).length !== expectedMediaCount || (row.mediaBlobIds || []).length !== expectedMediaCount) {
    throw new Error('Lokale Bild-Vollständigkeitsprüfung fehlgeschlagen');
  }
  const storedUrls = new Set((row.media || []).map(item => item.url));
  if (expectedMediaUrls.some(url => !storedUrls.has(url))) throw new Error('Lokale Bildzuordnung ist unvollständig');
  if (expectedStorageArtifacts.some(item => !storedUrls.has(item.url || `storage://${item.bucket}/${item.path}`))) {
    throw new Error('Lokale Storage-Dateizuordnung ist unvollständig');
  }
  return { ...row, verifiedAt: nowIso() };
}

export async function getRecoverableProjectSessions() {
  const db = await openOfflineDatabase();
  const rows = await db.getAll(OFFLINE_STORES.SESSIONS);
  return rows.filter(row => row.state === 'offline_available').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function hasActiveProjectSession() {
  const sessions = await getRecoverableProjectSessions();
  return sessions.length > 0;
}

/** Markiert die lokale Sitzung nach vollständigem externem Nachweis als beendet.
 * Der Snapshot bleibt erhalten; eine spätere Cache-Policy darf separat entscheiden.
 */
export async function confirmProjectSession(projectId, evidence) {
  if (!evidence?.db?.verified || !evidence?.storage?.verified || !evidence?.oneDrive?.verified || !evidence?.content?.verified) {
    throw new Error('Projektsitzung darf ohne vollständige Cloud-Evidenz nicht bestätigt werden');
  }
  const db = await openOfflineDatabase();
  const tx = db.transaction(OFFLINE_STORES.SESSIONS, 'readwrite', { durability: 'strict' });
  const row = await tx.store.get(projectId);
  if (!row || row.state !== 'offline_available') throw new Error('Aktive lokale Projektsitzung fehlt');
  row.state = 'fully_confirmed';
  row.confirmationEvidence = evidence;
  row.confirmedAt = nowIso();
  row.updatedAt = row.confirmedAt;
  await tx.store.put(row);
  await tx.done;
  return row;
}

/** Persists successful sync evidence without removing crash/reload recovery.
 * The session remains offline_available until navigation has actually completed.
 */
export async function stageProjectSessionConfirmation(projectId, evidence) {
  if (!evidence?.db?.verified || !evidence?.storage?.verified || !evidence?.oneDrive?.verified || !evidence?.content?.verified) {
    throw new Error('Projektsitzung darf ohne vollständige Cloud-Evidenz nicht vorgemerkt werden');
  }
  const db = await openOfflineDatabase();
  const tx = db.transaction(OFFLINE_STORES.SESSIONS, 'readwrite', { durability: 'strict' });
  const row = await tx.store.get(projectId);
  if (!row || row.state !== 'offline_available') throw new Error('Aktive lokale Projektsitzung fehlt');
  row.stagedConfirmationEvidence = evidence;
  row.syncVerifiedAt = nowIso();
  row.updatedAt = row.syncVerifiedAt;
  await tx.store.put(row);
  await tx.done;
  return row;
}

export async function updateProjectSessionSnapshot(projectId, snapshot, { localRevision = null } = {}) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(OFFLINE_STORES.SESSIONS, 'readwrite', { durability: 'strict' });
  const row = await tx.store.get(projectId);
  if (!row) return null;
  const incomingRevision = Number(localRevision || 0);
  const storedRevision = Number(row.localRevision || 0);
  if (incomingRevision && incomingRevision <= storedRevision) {
    await tx.done;
    return { ...row, staleWriteRejected: true, rejectedRevision: incomingRevision };
  }
  const previousUrls = new Set((row.media || []).map(item => item.url));
  const nextUrls = collectProjectMediaUrls(snapshot);
  if (nextUrls.some(url => !previousUrls.has(url))) {
    tx.abort();
    throw new Error('Neue Bilddatei muss atomar über die zentrale Medien-Outbox gespeichert werden');
  }
  row.snapshot = snapshot;
  row.snapshotChecksum = await sha256CanonicalProjectContent(snapshot);
  row.counts = countProjectContent(snapshot);
  if (incomingRevision) row.localRevision = incomingRevision;
  row.updatedAt = nowIso();
  await tx.store.put(row);
  await tx.done;
  return verifyProjectSession(projectId, { sessionId: row.sessionId, lockToken: row.lockToken, expectedCounts: row.counts });
}
