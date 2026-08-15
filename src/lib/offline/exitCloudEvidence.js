import { sha256Hex } from './supabaseMediaHandlers.js';
import { sha256CanonicalProjectContent } from './canonicalDigest.js';
import { OFFLINE_STORES, openOfflineDatabase } from './db.js';

const rows = value => Array.isArray(value) ? value : [];
const lower = value => String(value || '').toLowerCase();

async function expectedArtifacts(localSession) {
  const materialized = localSession?.snapshot?._offlineMaterialization || {};
  const media = rows(localSession?.media);
  const declared = rows(materialized.storageArtifacts).map(artifact => {
    const source = artifact.path
      ? `storage://${artifact.bucket}/${artifact.path}`
      : artifact.url;
    const local = media.find(item =>
      (artifact.entityId && String(item.entityId || '') === String(artifact.entityId)) ||
      (source && item.url === source));
    if (!artifact.bucket || !artifact.path) {
      throw new Error(`Storage-Evidenz nicht möglich (Bucket/Pfad fehlt): ${artifact.entityId || source || 'unbekannt'}`);
    }
    if (!local?.checksum || !Number(local?.size)) {
      throw new Error(`Lokale Byte-Evidenz fehlt: ${artifact.bucket}/${artifact.path}`);
    }
    return {
      entityId: String(artifact.entityId || local.entityId || ''),
      bucket: artifact.bucket,
      path: artifact.path,
      size: Number(local.size),
      checksum: lower(local.checksum),
    };
  });
  // Media created after project admission lives in the durable transaction
  // outbox, not in the admission-time materialisation. Include it before any
  // operation may be pruned/confirmed so the final gate covers new captures.
  try {
    const db = await openOfflineDatabase();
    const operations = await db.getAllFromIndex(OFFLINE_STORES.OUTBOX, 'by-project', localSession.projectId);
    for (const operation of operations) {
      const target = operation?.payload?.cloudTarget;
      if (!operation?.blobId || !target?.bucket || !target?.path) continue;
      const blob = await db.get(OFFLINE_STORES.BLOBS, operation.blobId);
      if (!blob?.checksum || !Number(blob?.size)) throw new Error(`Outbox-Byte-Evidenz fehlt: ${operation.operationId}`);
      declared.push({
        entityId: String(operation.entityId || operation.payload?.association?.entityId || ''),
        bucket: target.bucket, path: target.path, size: Number(blob.size), checksum: lower(blob.checksum),
      });
    }
  } catch (error) {
    // Unit/non-browser callers can provide the fully materialised artifact set.
    // In a real browser an IndexedDB failure is a hard stop.
    if (typeof indexedDB !== 'undefined') throw error;
  }
  const unique = new Map();
  for (const artifact of declared) unique.set(`${artifact.entityId}|${artifact.bucket}|${artifact.path}`, artifact);
  return [...unique.values()];
}

/** Produces provider evidence from fresh reads only. No report_data flag or
 * cached metadata can satisfy this gate. */
export async function collectStrictExitCloudEvidence(supabase, localSession) {
  if (!supabase?.storage?.from || !supabase?.from) throw new TypeError('Supabase-Client fehlt');
  const projectId = String(localSession?.projectId || localSession?.snapshot?.id || '');
  if (!projectId) throw new Error('Projekt-ID für Cloud-Evidenz fehlt');
  const artifacts = await expectedArtifacts(localSession);
  const storageEntries = [];
  for (const artifact of artifacts) {
    const { data: blob, error } = await supabase.storage.from(artifact.bucket).download(artifact.path);
    if (error || !(blob instanceof Blob) || !blob.size) {
      throw error || new Error(`Storage-Byte-Readback fehlt: ${artifact.bucket}/${artifact.path}`);
    }
    const checksum = lower(await sha256Hex(blob));
    if (blob.size !== artifact.size || checksum !== artifact.checksum) {
      throw new Error(`Storage-Byte-Readback abweichend: ${artifact.bucket}/${artifact.path}`);
    }
    storageEntries.push({ ...artifact, readbackSize: blob.size, readbackChecksum: checksum });
  }

  const { data: journal, error: journalError } = await supabase
    .from('project_image_uploads')
    .select('project_id,local_image_id,storage_bucket,storage_path,storage_status,size_bytes,sha256,remote_path,remote_drive_id,remote_item_id,remote_etag,remote_size_bytes,remote_sha256,verified_at')
    .eq('project_id', projectId);
  if (journalError) throw journalError;
  const journalRows = rows(journal);
  const oneDriveEntries = artifacts.map(artifact => {
    const row = journalRows.find(item =>
      String(item.local_image_id || '') === artifact.entityId &&
      item.storage_bucket === artifact.bucket && item.storage_path === artifact.path);
    const valid = row?.storage_status === 'remote_verified' && row.remote_drive_id &&
      row.remote_item_id && row.remote_etag && row.remote_path && row.verified_at &&
      Number(row.size_bytes) === artifact.size && Number(row.remote_size_bytes) === artifact.size &&
      lower(row.sha256) === artifact.checksum && lower(row.remote_sha256) === artifact.checksum;
    if (!valid) throw new Error(`OneDrive-Journal-Evidenz fehlt oder weicht ab: ${artifact.entityId || artifact.path}`);
    return {
      entityId: artifact.entityId, driveId: row.remote_drive_id,
      itemId: row.remote_item_id, eTag: row.remote_etag, path: row.remote_path,
      size: Number(row.remote_size_bytes), checksum: lower(row.remote_sha256),
      verifiedAt: row.verified_at,
    };
  });

  // A project without any durable artifact has nothing to prove in Storage or
  // OneDrive. The evidence is still explicit and derived from a fresh empty
  // artifact/journal comparison, not inferred from missing metadata.
  const storageChecksum = await sha256CanonicalProjectContent(storageEntries);
  const oneDriveChecksum = await sha256CanonicalProjectContent(oneDriveEntries);
  return {
    storage: {
      verified: storageEntries.length === artifacts.length,
      artifactCount: artifacts.length, entries: storageEntries,
      checksum: storageChecksum, checkedAt: new Date().toISOString(),
    },
    oneDrive: {
      verified: oneDriveEntries.length === artifacts.length,
      artifactCount: artifacts.length, entries: oneDriveEntries,
      // Compatibility summary fields remain backed by the complete journal.
      itemId: artifacts.length ? `journal:${oneDriveEntries.length}` : 'journal:empty',
      eTag: oneDriveChecksum, checksum: oneDriveChecksum,
      checkedAt: new Date().toISOString(),
    },
  };
}
