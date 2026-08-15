const blockingCount = (summary = {}) => ['queued', 'uploading', 'failed', 'conflict']
  .reduce((total, state) => total + Number(summary.byStatus?.[state] || 0), 0);

export function buildStrictExitReadiness({
  localConfirmed = false,
  dbEvidence = null,
  storageEvidence = null,
  oneDriveEvidence = null,
  outboxSummary = null,
  legacyUploadSummary = null,
  unverifiedOneDriveMedia = [],
  contentEvidence = null,
} = {}) {
  const reasons = [];
  if (!localConfirmed) reasons.push('local_unconfirmed');
  if (!dbEvidence?.verified || !dbEvidence?.id || !dbEvidence?.version) reasons.push('supabase_db_unconfirmed');
  const storageCount = Number(storageEvidence?.artifactCount);
  const storageEntries = Array.isArray(storageEvidence?.entries) ? storageEvidence.entries : null;
  const storageComplete = storageEvidence?.verified && Number.isInteger(storageCount) &&
    storageEntries && storageEntries.length === storageCount && storageEntries.every(entry =>
      Number(entry?.readbackSize) > 0 && /^[a-f0-9]{64}$/i.test(String(entry?.readbackChecksum || '')));
  if (!storageComplete) reasons.push('supabase_storage_unconfirmed');
  const oneDriveCount = Number(oneDriveEvidence?.artifactCount);
  const oneDriveEntries = Array.isArray(oneDriveEvidence?.entries) ? oneDriveEvidence.entries : null;
  const oneDriveComplete = oneDriveEvidence?.verified && oneDriveEvidence?.itemId &&
    oneDriveEvidence?.eTag && /^[a-f0-9]{64}$/i.test(String(oneDriveEvidence?.checksum || '')) &&
    Number.isInteger(oneDriveCount) && oneDriveEntries && oneDriveEntries.length === oneDriveCount &&
    oneDriveEntries.every(entry => entry?.driveId && entry?.itemId && entry?.eTag &&
      Number(entry?.size) > 0 && /^[a-f0-9]{64}$/i.test(String(entry?.checksum || '')));
  if (!oneDriveComplete) {
    reasons.push('onedrive_project_unconfirmed');
  }
  if (!outboxSummary || Number(outboxSummary.total || 0) !== 0 || blockingCount(outboxSummary) !== 0) {
    reasons.push('outbox_not_empty');
  }
  if (!legacyUploadSummary || Number(legacyUploadSummary.pending || 0) > 0 ||
      Number(legacyUploadSummary.uploading || 0) > 0 || Number(legacyUploadSummary.uploaded || 0) > 0 ||
      Number(legacyUploadSummary.failed || 0) > 0 || Number(legacyUploadSummary.needsRepair || 0) > 0 ||
      Number(legacyUploadSummary.verified || 0) !== Number(legacyUploadSummary.total || 0)) {
    reasons.push('legacy_upload_queue_unconfirmed');
  }
  if (unverifiedOneDriveMedia.length > 0) reasons.push('onedrive_media_unconfirmed');
  if (!contentEvidence?.verified) reasons.push('content_exact_match_unconfirmed');
  return {
    status: reasons.length === 0 ? 'fully_confirmed' : 'blocked',
    verified: reasons.length === 0,
    reasons,
    evidence: {
      db: dbEvidence,
      storage: storageEvidence,
      oneDrive: oneDriveEvidence,
      outbox: outboxSummary,
      legacyUploadQueue: legacyUploadSummary,
      unverifiedOneDriveMedia: [...unverifiedOneDriveMedia],
      content: contentEvidence,
    },
  };
}
