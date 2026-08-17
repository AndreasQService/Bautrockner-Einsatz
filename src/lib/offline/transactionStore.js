import { v4 as uuidv4 } from 'uuid';
import { OFFLINE_STORES, openOfflineDatabase } from './db.js';
import { OFFLINE_STATES, assertStateTransition } from './states.js';
import { sha256CanonicalProjectContent } from './canonicalDigest.js';

const ALL_STORES = Object.values(OFFLINE_STORES);

const nowIso = () => new Date().toISOString();

function requireText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} muss eine nicht-leere Zeichenfolge sein`);
  }
  return value;
}

function normaliseError(error) {
  if (!error) return null;
  return {
    message: String(error.message || error),
    code: error.code ? String(error.code) : null,
    at: nowIso(),
  };
}

function transactionStatus(operations) {
  if (operations.length === 0) return OFFLINE_STATES.CLOUD_CONFIRMED;
  const states = new Set(operations.map((operation) => operation.status));
  if (states.has(OFFLINE_STATES.CONFLICT)) return OFFLINE_STATES.CONFLICT;
  if (states.has(OFFLINE_STATES.FAILED)) return OFFLINE_STATES.FAILED;
  if (states.has(OFFLINE_STATES.UPLOADING)) return OFFLINE_STATES.UPLOADING;
  if ([...states].every((state) => state === OFFLINE_STATES.CLOUD_CONFIRMED)) {
    return OFFLINE_STATES.CLOUD_CONFIRMED;
  }
  return OFFLINE_STATES.QUEUED;
}

/**
 * Sichert Projekt-Snapshot, Datei-Blobs, Manifest und Outbox atomar lokal.
 * Es findet keinerlei Netzwerkzugriff statt.
 */
export async function createOfflineTransaction({
  projectId,
  snapshot,
  blobs = [],
  operations = [],
  actor = null,
  device = null,
  baseVersion = null,
  transactionId = uuidv4(),
}) {
  requireText(projectId, 'projectId');
  requireText(transactionId, 'transactionId');
  if (snapshot === undefined) throw new TypeError('snapshot ist erforderlich');
  if (!Array.isArray(blobs) || !Array.isArray(operations)) {
    throw new TypeError('blobs und operations müssen Arrays sein');
  }

  const createdAt = nowIso();
  const snapshotChecksum = await sha256CanonicalProjectContent(snapshot);
  const blobRows = blobs.map((entry, index) => {
    if (!(entry?.blob instanceof Blob)) throw new TypeError(`blobs[${index}].blob muss ein Blob sein`);
    return {
      blobId: entry.blobId || uuidv4(),
      transactionId,
      projectId,
      kind: entry.kind || 'attachment',
      entityId: entry.entityId || null,
      name: entry.name || entry.blob.name || null,
      mimeType: entry.blob.type || entry.mimeType || 'application/octet-stream',
      size: entry.blob.size,
      checksum: entry.checksum || null,
      blob: entry.blob,
      createdAt,
    };
  });

  const operationRows = operations.map((operation, index) => {
    const operationId = operation.operationId || uuidv4();
    return {
      operationId,
      idempotencyKey: operation.idempotencyKey || `${transactionId}:${index}:${operation.type || 'sync'}`,
      transactionId,
      projectId,
      type: requireText(operation.type || 'sync', `operations[${index}].type`),
      entityId: operation.entityId || null,
      blobId: operation.blobId || blobRows[index]?.blobId || null,
      payload: operation.payload ?? null,
      baseVersion: operation.baseVersion ?? baseVersion,
      status: OFFLINE_STATES.QUEUED,
      attemptCount: 0,
      nextAttemptAt: createdAt,
      leaseUntil: null,
      error: null,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const manifest = {
    transactionId,
    projectId,
    actor,
    device,
    baseVersion,
    status: OFFLINE_STATES.LOCAL_SAVING,
    snapshotProjectId: projectId,
    snapshotChecksum,
    blobIds: blobRows.map(({ blobId }) => blobId),
    blobAssociations: blobRows.map(({ blobId, entityId, kind, size, checksum }) => ({
      blobId, entityId, kind, size, checksum,
    })),
    operationIds: operationRows.map(({ operationId }) => operationId),
    createdAt,
    updatedAt: createdAt,
    localConfirmedAt: null,
    cloudConfirmedAt: null,
  };

  const db = await openOfflineDatabase();
  try {
    const tx = db.transaction(ALL_STORES, 'readwrite', { durability: 'strict' });
    await tx.objectStore(OFFLINE_STORES.TRANSACTIONS).add(manifest);
    await tx.objectStore(OFFLINE_STORES.SNAPSHOTS).add({
      projectId,
      transactionId,
      data: snapshot,
      baseVersion,
      updatedAt: createdAt,
    });
    for (const row of blobRows) await tx.objectStore(OFFLINE_STORES.BLOBS).add(row);
    for (const row of operationRows) await tx.objectStore(OFFLINE_STORES.OUTBOX).add(row);

    await tx.done;
  } catch (err) {
    if (err.name === 'AbortError' || (err instanceof DOMException && err.name === 'AbortError')) {
      console.warn('[transactionStore] Transaction aborted gracefully (project exit):', err.message);
      return manifest;
    }
    throw err;
  }

  // Exact durable readback is the local commit boundary. Merely completing the
  // write transaction is insufficient evidence on interruption-prone iOS.
  const [snapshotReadback, blobsReadback, outboxReadback] = await Promise.all([
    db.get(OFFLINE_STORES.SNAPSHOTS, transactionId),
    db.getAllFromIndex(OFFLINE_STORES.BLOBS, 'by-transaction', transactionId),
    db.getAllFromIndex(OFFLINE_STORES.OUTBOX, 'by-transaction', transactionId),
  ]);
  if (!snapshotReadback || await sha256CanonicalProjectContent(snapshotReadback.data) !== snapshotChecksum) {
    throw new Error('Lokaler Snapshot-Readback: Prüfsumme stimmt nicht');
  }
  if (blobsReadback.length !== blobRows.length || outboxReadback.length !== operationRows.length) {
    throw new Error('Lokaler Snapshot-Readback: Blob-/Outbox-Vollständigkeit stimmt nicht');
  }
  for (const expectedBlob of blobRows) {
    const actual = blobsReadback.find(item => item.blobId === expectedBlob.blobId);
    if (!actual || actual.size !== expectedBlob.size || actual.entityId !== expectedBlob.entityId) {
      throw new Error('Lokaler Snapshot-Readback: Medienzuordnung stimmt nicht');
    }
    if (expectedBlob.checksum) {
      const digest = await crypto.subtle.digest('SHA-256', await actual.blob.arrayBuffer());
      const checksum = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (checksum !== expectedBlob.checksum) throw new Error('Lokaler Snapshot-Readback: Medien-Prüfsumme stimmt nicht');
    }
  }
  const localConfirmedAt = nowIso();
  manifest.status = operationRows.length ? OFFLINE_STATES.QUEUED : OFFLINE_STATES.CLOUD_CONFIRMED;
  manifest.localConfirmedAt = localConfirmedAt;
  manifest.cloudConfirmedAt = operationRows.length ? null : localConfirmedAt;
  manifest.updatedAt = localConfirmedAt;
  await db.put(OFFLINE_STORES.TRANSACTIONS, manifest);
  return manifest;
}

/**
 * Schlanke Integrations-API für Formulare, Medien und Messprotokolle.
 * Der lokale Commit ist abgeschlossen, bevor das Promise aufgelöst wird.
 * Ein separater Sync-Worker darf erst danach Netzwerkzugriffe ausführen.
 */
export async function registerLocalMutation({
  projectId,
  type,
  entityId = null,
  payload = null,
  snapshot,
  blob = null,
  blobs = [],
  actor = null,
  device = null,
  baseVersion = null,
  idempotencyKey = null,
  transactionId,
} = {}) {
  requireText(type, 'type');
  const allBlobs = blob ? [blob, ...blobs] : blobs;
  let manifest;
  try {
    manifest = await createOfflineTransaction({
      projectId,
      snapshot: snapshot ?? { projectId, type, entityId, payload },
      blobs: allBlobs,
      operations: [{ type, entityId, payload, idempotencyKey }],
      actor,
      device,
      baseVersion,
      transactionId,
    });
  } catch (err) {
    if (err.name === 'AbortError' || (err instanceof DOMException && err.name === 'AbortError')) {
      console.warn('[registerLocalMutation] Transaction aborted gracefully (project exit):', err.message);
      return null;
    }
    throw err;
  }
  // Inactivity is measured from a real, read-back-verified local business
  // mutation—not from clicks, scrolling or merely viewing the project.
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('qtool:local-mutation-confirmed', {
      detail: { projectId: String(projectId), type, transactionId: manifest.transactionId },
    }));
  }
  return {
    ...manifest,
    transactionId: manifest.transactionId,
    operationIds: [...manifest.operationIds],
    blobIds: [...manifest.blobIds],
  };
}

export async function getProjectSnapshot(projectId) {
  const db = await openOfflineDatabase();
  const rows = await db.getAllFromIndex(
    OFFLINE_STORES.SNAPSHOTS,
    'by-project',
    requireText(projectId, 'projectId'),
  );
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export async function getTransactionSnapshot(transactionId) {
  const db = await openOfflineDatabase();
  return db.get(
    OFFLINE_STORES.SNAPSHOTS,
    requireText(transactionId, 'transactionId'),
  );
}

export async function getOfflineBlob(blobId) {
  const db = await openOfflineDatabase();
  return db.get(OFFLINE_STORES.BLOBS, requireText(blobId, 'blobId'));
}

export async function getTransactionManifest(transactionId) {
  const db = await openOfflineDatabase();
  return db.get(OFFLINE_STORES.TRANSACTIONS, requireText(transactionId, 'transactionId'));
}

export async function listPendingOperations({ projectId = null, limit = 100 } = {}) {
  const db = await openOfflineDatabase();
  const rows = projectId
    ? await db.getAllFromIndex(OFFLINE_STORES.OUTBOX, 'by-project', projectId)
    : await db.getAll(OFFLINE_STORES.OUTBOX);
  return rows
    .filter(({ status }) => status !== OFFLINE_STATES.CLOUD_CONFIRMED)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, Math.max(0, limit));
}

/** Beansprucht fällige Aufträge atomar für genau einen Worker. */
export async function claimPendingOperations({ limit = 10, leaseMs = 30_000, projectId = null, forceLeaseReset = false } = {}) {
  const db = await openOfflineDatabase();
  const tx = db.transaction(OFFLINE_STORES.OUTBOX, 'readwrite', { durability: 'strict' });
  const store = tx.store;
  const rows = await store.getAll();
  const now = Date.now();
  const claimed = [];

  for (const row of rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (projectId && String(row.projectId) !== String(projectId)) continue;
    if (forceLeaseReset && row.status === OFFLINE_STATES.UPLOADING) {
      row.status = OFFLINE_STATES.QUEUED;
      row.leaseUntil = null;
    }
    const leaseExpired = row.status === OFFLINE_STATES.UPLOADING && Date.parse(row.leaseUntil || 0) <= now;
    const due = Date.parse(row.nextAttemptAt || 0) <= now;
    if ((!leaseExpired && row.status !== OFFLINE_STATES.QUEUED) || !due) continue;
    assertStateTransition(row.status, OFFLINE_STATES.UPLOADING);
    row.status = OFFLINE_STATES.UPLOADING;
    row.attemptCount += 1;
    row.leaseUntil = new Date(now + leaseMs).toISOString();
    row.updatedAt = nowIso();
    await store.put(row);
    claimed.push(row);
    if (claimed.length >= limit) break;
  }
  await tx.done;
  return claimed;
}

export async function setOperationStatus(operationId, status, { error = null, retryAt = null } = {}) {
  const db = await openOfflineDatabase();
  const tx = db.transaction([OFFLINE_STORES.OUTBOX, OFFLINE_STORES.TRANSACTIONS], 'readwrite', {
    durability: 'strict',
  });
  const outbox = tx.objectStore(OFFLINE_STORES.OUTBOX);
  const operation = await outbox.get(requireText(operationId, 'operationId'));
  if (!operation) throw new Error(`Outbox-Auftrag nicht gefunden: ${operationId}`);
  assertStateTransition(operation.status, status);
  operation.status = status;
  operation.error = normaliseError(error);
  operation.leaseUntil = null;
  operation.nextAttemptAt = retryAt ? new Date(retryAt).toISOString() : operation.nextAttemptAt;
  operation.updatedAt = nowIso();
  await outbox.put(operation);

  const siblings = await outbox.index('by-transaction').getAll(operation.transactionId);
  const manifestStore = tx.objectStore(OFFLINE_STORES.TRANSACTIONS);
  const manifest = await manifestStore.get(operation.transactionId);
  manifest.status = transactionStatus(siblings.map((row) => (
    row.operationId === operation.operationId ? operation : row
  )));
  manifest.updatedAt = nowIso();
  if (manifest.status === OFFLINE_STATES.CLOUD_CONFIRMED) manifest.cloudConfirmedAt = manifest.updatedAt;
  await manifestStore.put(manifest);
  await tx.done;
  return { operation, manifest };
}

export async function retryOperation(operationId, retryAt = new Date()) {
  return setOperationStatus(operationId, OFFLINE_STATES.QUEUED, { retryAt });
}

export async function getPendingSummary(projectId = null) {
  const pending = await listPendingOperations({ projectId, limit: Number.MAX_SAFE_INTEGER });
  const byStatus = Object.fromEntries(Object.values(OFFLINE_STATES).map((state) => [state, 0]));
  for (const operation of pending) byStatus[operation.status] += 1;
  return {
    projectId,
    total: pending.length,
    byStatus,
    transactionIds: [...new Set(pending.map(({ transactionId }) => transactionId))],
  };
}

/** Bestätigt Projekt-Aufträge nur nach einem extern verifizierten DB-Readback. */
export async function confirmProjectOperations(projectId, {
  verifiedAt = new Date(),
  verifiedVersion = null,
} = {}) {
  requireText(projectId, 'projectId');
  const cutoff = new Date(verifiedAt).toISOString();
  const db = await openOfflineDatabase();
  const rows = await db.getAllFromIndex(OFFLINE_STORES.OUTBOX, 'by-project', projectId);
  const eligible = rows.filter((row) =>
    row.type === 'project.upsert' &&
    [OFFLINE_STATES.QUEUED, OFFLINE_STATES.UPLOADING].includes(row.status) &&
    row.createdAt <= cutoff &&
    (verifiedVersion == null || row.baseVersion == null || Number(row.baseVersion) <= Number(verifiedVersion))
  );
  const confirmed = [];
  for (const row of eligible) {
    await setOperationStatus(row.operationId, OFFLINE_STATES.CLOUD_CONFIRMED);
    confirmed.push(row.operationId);
  }
  return confirmed;
}

/**
 * Entfernt ausschließlich vollständig cloudbestätigte Transaktionen nach Ablauf
 * der Aufbewahrungsfrist. Pending Daten und deren Blobs/Snapshots bleiben erhalten.
 */
export async function pruneConfirmedOfflineData({
  enabled = false,
  retentionMs = 7 * 24 * 60 * 60 * 1000,
} = {}) {
  // Projektcache-/Download-Policy ist noch nicht fachlich freigegeben.
  // Bereinigung bleibt deshalb standardmässig vollständig deaktiviert.
  if (enabled !== true) return [];
  const cutoff = Date.now() - Math.max(retentionMs, 7 * 24 * 60 * 60 * 1000);
  const db = await openOfflineDatabase();
  const tx = db.transaction(ALL_STORES, 'readwrite', { durability: 'strict' });
  const manifests = await tx.objectStore(OFFLINE_STORES.TRANSACTIONS).getAll();
  const removed = [];
  for (const manifest of manifests) {
    if (manifest.status !== OFFLINE_STATES.CLOUD_CONFIRMED) continue;
    if (Date.parse(manifest.cloudConfirmedAt || manifest.updatedAt) > cutoff) continue;
    const snapshot = await tx.objectStore(OFFLINE_STORES.SNAPSHOTS).get(manifest.transactionId);
    const data = snapshot?.data || {};
    const completionState = String(
      data.status || data.projectStatus || data.workflowStatus || data.workflowStep || '',
    ).trim().toLowerCase();
    const isCompletedProject = data.completed === true || data.isCompleted === true ||
      ['abschluss', 'abgeschlossen', 'completed', 'closed'].includes(completionState);
    // Aktive Projekte bleiben offline verfügbar. Selbst vollständig bestätigte
    // Transaktionen werden nur für ausdrücklich abgeschlossene Projekte bereinigt.
    if (!isCompletedProject) continue;
    const operations = await tx.objectStore(OFFLINE_STORES.OUTBOX)
      .index('by-transaction').getAll(manifest.transactionId);
    if (!operations.every(({ status }) => status === OFFLINE_STATES.CLOUD_CONFIRMED)) continue;
    for (const operation of operations) {
      await tx.objectStore(OFFLINE_STORES.OUTBOX).delete(operation.operationId);
    }
    for (const blobId of manifest.blobIds || []) {
      await tx.objectStore(OFFLINE_STORES.BLOBS).delete(blobId);
    }
    await tx.objectStore(OFFLINE_STORES.SNAPSHOTS).delete(manifest.transactionId);
    await tx.objectStore(OFFLINE_STORES.TRANSACTIONS).delete(manifest.transactionId);
    removed.push(manifest.transactionId);
  }
  await tx.done;
  return removed;
}
