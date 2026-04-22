/**
 * queueTypes.js
 * Typdefinitionen (JSDoc) für die durable Upload-Queue
 *
 * UploadStatus beschreibt den vollständigen Lebenszyklus eines Uploads:
 * queued → persisting → persisted → creating_session → uploading
 *   → uploaded_unverified → verified
 *   → paused / pending_resume / needs_repair / failed
 */

/**
 * @typedef {'queued'|'persisting'|'persisted'|'creating_session'|'uploading'|
 *           'paused'|'pending_resume'|'uploaded_unverified'|'verified'|
 *           'needs_repair'|'failed'} UploadStatus
 */

/**
 * @typedef {Object} UploadItem
 * @property {string}       id                  UUID
 * @property {string}       projectId           Projekt-ID
 * @property {string}       originalName        Originaler Dateiname
 * @property {string}       remoteFileName      Sicherer Dateiname auf OneDrive
 * @property {string}       remotePath          Voller OneDrive-Pfad
 * @property {string}       mimeType
 * @property {number}       size                Dateigrösse in Bytes
 * @property {string}       sha256              SHA-256 Hash des Blobs
 * @property {string}       createdAt           ISO-Timestamp
 * @property {string}       updatedAt           ISO-Timestamp
 * @property {UploadStatus} status
 * @property {number}       retryCount
 * @property {string}       [errorMessage]
 * @property {string}       [uploadSessionUrl]  OneDrive resumable session URL
 * @property {string[]}     [nextExpectedRanges]
 * @property {string}       [remoteItemId]      OneDrive Item ID (nach Verifikation)
 * @property {string}       [remoteETag]        OneDrive ETag (nach Verifikation)
 * @property {number}       bytesUploaded       Bereits hochgeladene Bytes
 */

export const UPLOAD_STATUSES = [
  'queued',
  'persisting',
  'persisted',
  'creating_session',
  'uploading',
  'paused',
  'pending_resume',
  'uploaded_unverified',
  'verified',
  'needs_repair',
  'failed',
];

/** Status-Labels für die UI */
export const STATUS_LABELS = {
  queued:              '⏳ In Warteschlange',
  persisting:         '💾 Wird lokal gespeichert…',
  persisted:          '✅ Lokal gespeichert',
  creating_session:   '🔗 Upload-Session wird erstellt…',
  uploading:          '⬆️ Wird hochgeladen…',
  paused:             '⏸️ Pausiert',
  pending_resume:     '🔄 Wird fortgesetzt…',
  uploaded_unverified:'⚠️ Hochgeladen (unbestätigt)',
  verified:           '✅ Bestätigt auf OneDrive',
  needs_repair:       '🔧 Reparatur nötig',
  failed:             '❌ Fehlgeschlagen',
};

/** Welche Status gelten als "noch ausstehend" (müssen weiterverarbeitet werden) */
export const ACTIONABLE_STATUSES = [
  'queued',
  'persisted',
  'creating_session',
  'uploading',
  'pending_resume',
  'uploaded_unverified',
  'needs_repair',
  'failed',
];
