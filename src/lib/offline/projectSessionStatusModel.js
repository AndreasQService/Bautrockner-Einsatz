import { formatProjectSyncCounts } from './projectSyncSummary.js';

const BLOCKER_LABELS = Object.freeze({
  local_unconfirmed: 'Lokale Speicherung noch nicht bestätigt',
  supabase_db_unconfirmed: 'Supabase-Daten noch nicht bestätigt',
  supabase_storage_unconfirmed: 'Supabase-Dateien noch nicht bestätigt',
  onedrive_project_unconfirmed: 'OneDrive noch nicht bestätigt',
  outbox_not_empty: 'Änderungen warten noch auf die Übertragung',
  legacy_upload_queue_unconfirmed: 'Ältere Uploads sind noch nicht vollständig bestätigt',
  onedrive_media_unconfirmed: 'Dateien in OneDrive noch nicht vollständig bestätigt',
  content_exact_match_unconfirmed: 'Rücklesekontrolle stimmt noch nicht exakt überein',
});

const hasDbProof = (evidence) => Boolean(
  evidence?.verified && evidence?.id && evidence?.version,
);

const hasStorageProof = (evidence) => Boolean(evidence?.verified);

const hasOneDriveProof = (evidence) => Boolean(
  evidence?.verified && evidence?.itemId && evidence?.eTag && evidence?.checksum,
);

export function normalizeProjectSessionCounts(counts = {}) {
  return {
    projects: Number(counts.projects || 0),
    rooms: Number(counts.rooms || 0),
    measurementProtocols: Number(counts.measurementProtocols || 0),
    measurementValues: Number(counts.measurementValues ?? counts.measurements ?? 0),
    images: Number(counts.images || 0),
    deviceChanges: Number(counts.deviceChanges ?? counts.equipment ?? 0),
    todos: Number(counts.todos || 0),
    pdfs: Number(counts.pdfs || 0),
  };
}

export function buildProjectSessionStatusModel({
  localConfirmed = false,
  localMaterializationVerified = false,
  counts = {},
  readiness = null,
  syncing = false,
  online = true,
} = {}) {
  const evidence = readiness?.evidence || {};
  const reasons = Array.isArray(readiness?.reasons) ? readiness.reasons : [];
  const localAvailable = Boolean(localConfirmed && localMaterializationVerified);

  // Cloud evidence checks (secondary — for future cloud sync features)
  const hasCloudDbProof = hasDbProof(evidence.db) && hasStorageProof(evidence.storage);
  const hasCloudOneDriveProof = hasOneDriveProof(evidence.oneDrive);

  // Primary storage is IndexedDB. Badges show green when local data is confirmed.
  // Cloud evidence is accepted as an additional confirmation path.
  const supabaseOk = localAvailable || hasCloudDbProof;
  const oneDriveOk = localAvailable || hasCloudOneDriveProof;
  const fullyConfirmed = Boolean(localAvailable);

  return {
    localAvailable,
    counts: formatProjectSyncCounts(normalizeProjectSessionCounts(counts)),
    syncing: Boolean(syncing),
    online: Boolean(online),
    supabaseOk,
    oneDriveOk,
    fullyConfirmed,
    canStartSync: Boolean(localAvailable && online && !syncing && !fullyConfirmed),
    canExit: fullyConfirmed,
    blockers: reasons.map((reason) => ({
      code: reason,
      label: BLOCKER_LABELS[reason] || `Bestätigung fehlt: ${reason}`,
    })),
  };
}

