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
  const contentVerified = Boolean(evidence.content?.verified);
  const outboxEmpty = Boolean(evidence.outbox && Number(evidence.outbox.total || 0) === 0);
  const legacyQueueVerified = Boolean(
    evidence.legacyUploadQueue &&
    Number(evidence.legacyUploadQueue.verified || 0) === Number(evidence.legacyUploadQueue.total || 0) &&
    Number(evidence.legacyUploadQueue.pending || 0) === 0 &&
    Number(evidence.legacyUploadQueue.uploading || 0) === 0 &&
    Number(evidence.legacyUploadQueue.uploaded || 0) === 0 &&
    Number(evidence.legacyUploadQueue.failed || 0) === 0 &&
    Number(evidence.legacyUploadQueue.needsRepair || 0) === 0
  );
  const noUnverifiedOneDriveMedia = Array.isArray(evidence.unverifiedOneDriveMedia) &&
    evidence.unverifiedOneDriveMedia.length === 0;

  // A green provider badge is intentionally stricter than a successful request.
  // It requires durable provider evidence plus the relevant completion barriers.
  const supabaseOk = hasDbProof(evidence.db) && hasStorageProof(evidence.storage) &&
    contentVerified && outboxEmpty && legacyQueueVerified;
  const oneDriveOk = hasOneDriveProof(evidence.oneDrive) && noUnverifiedOneDriveMedia &&
    outboxEmpty && legacyQueueVerified;
  const fullyConfirmed = Boolean(
    readiness?.verified && readiness?.status === 'fully_confirmed' &&
    localAvailable && supabaseOk && oneDriveOk,
  );

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
