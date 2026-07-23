/**
 * oneDriveTestGuard.js
 * Central, strict path and testRunId validator for QTool Test Environment.
 * Used by both client-side upload routines and test verification scripts.
 */

export const EXPECTED_TEST_ROOT = 'QTool_TEST_ONLY';
export const TESTRUN_ID_REGEX = /^TESTRUN_\d{4}-\d{2}-\d{2}_\d{6}_[A-Z0-9]{4,12}$/;
export const ALLOWED_SUBFOLDERS = new Set(['Fotos', 'Dokumente', 'Messprotokolle', 'Manifest']);

const WINDOWS_RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

/**
 * Validates a testRunId string strictly against the expected format.
 * @param {string} testRunId
 * @returns {boolean}
 */
export function validateTestRunId(testRunId) {
  if (!testRunId || typeof testRunId !== 'string') return false;
  if (testRunId.length < 25 || testRunId.length > 50) return false;
  return TESTRUN_ID_REGEX.test(testRunId);
}

/**
 * Validates a single path segment for safety and prefix compliance.
 * @param {string} segment
 * @param {object} options
 */
function validatePathSegment(segment, { allowManifest = false, isProjectFolder = false, isFileName = false } = {}) {
  if (!segment || typeof segment !== 'string' || segment.trim() === '') {
    throw new Error('[ONEDRIVE GUARD] Segment darf nicht leer sein.');
  }

  // Length limits
  if (segment.length > 150) {
    throw new Error(`[ONEDRIVE GUARD] Segment zu lang (${segment.length} Zeichen).`);
  }

  // Forbidden characters: slashes, backslashes, colons, null bytes, percent, query, hash, control chars, unicode slashes
  if (/[\/\\:\*\?"<>\|%\x00-\x1F\u2044\u2215\u29F8\uFF0F\uFF3C]/.test(segment)) {
    throw new Error(`[ONEDRIVE GUARD] Unzulässiges Zeichen in Segment '${segment}'.`);
  }

  // No dot segments or trailing dots/spaces
  if (segment === '.' || segment === '..' || segment.endsWith('.') || segment.endsWith(' ')) {
    throw new Error(`[ONEDRIVE GUARD] Segment '${segment}' darf nicht auf Punkt/Leerzeichen enden oder '.'/'..' sein.`);
  }

  // Windows reserved names
  const rawBaseName = segment.split('.')[0].replace(/^TEST__/, '').toUpperCase();
  if (WINDOWS_RESERVED.has(rawBaseName)) {
    throw new Error(`[ONEDRIVE GUARD] Reservierter Systemname '${segment}' unzulässig.`);
  }

  // Manifest file check
  if (allowManifest && segment === 'TEST_MANIFEST.json') {
    return true;
  }

  // Prefix checks for project folder and file name
  if (isProjectFolder && !segment.startsWith('TEST__')) {
    throw new Error(`[ONEDRIVE GUARD] Projektordner '${segment}' muss mit 'TEST__' beginnen.`);
  }

  if (isFileName && !segment.startsWith('TEST__')) {
    throw new Error(`[ONEDRIVE GUARD] Dateiname '${segment}' muss mit 'TEST__' beginnen.`);
  }

  return true;
}

/**
 * Validates a calculated OneDrive remote path for test isolation.
 * Throws explicit descriptive error if invalid or prohibited.
 *
 * Expected Schema:
 *   QTool_TEST_ONLY / TESTRUN_<valid_id> / TEST__<project> / <subfolder> / TEST__<file>
 * Or root manifest:
 *   QTool_TEST_ONLY / TESTRUN_<valid_id> / TEST_MANIFEST.json
 *
 * @param {string} fullRemotePath  e.g. "QTool_TEST_ONLY/TESTRUN_2026-07-21_143000_A7K2/TEST__P001/Fotos/TEST__img.jpg"
 * @param {string} testRunId       e.g. "TESTRUN_2026-07-21_143000_A7K2"
 */
export function validateOneDrivePath(fullRemotePath, testRunId) {
  // Check env variable (in Vite context)
  const envTestRoot = import.meta.env?.VITE_ONEDRIVE_TEST_ROOT || process.env?.ONEDRIVE_TEST_ROOT;
  if (envTestRoot !== EXPECTED_TEST_ROOT) {
    throw new Error(`[ONEDRIVE GUARD ABORT] TEST_ROOT env var ('${envTestRoot}') muss exakt '${EXPECTED_TEST_ROOT}' sein!`);
  }

  if (!fullRemotePath || typeof fullRemotePath !== 'string') {
    throw new Error('[ONEDRIVE GUARD ABORT] Remote Pfad ist leer oder ungültig.');
  }

  // Global length limit
  if (fullRemotePath.length > 400) {
    throw new Error('[ONEDRIVE GUARD ABORT] Gesamtpfad überschreitet Maximallänge von 400 Zeichen.');
  }

  // Strict URL & character checks on full raw path string
  if (/[\%\?\#\\:\x00-\x1F\u2044\u2215\u29F8\uFF0F\uFF3C]/.test(fullRemotePath)) {
    throw new Error(`[ONEDRIVE GUARD ABORT] Illegales Sonderzeichen oder Kodierung in Pfad '${fullRemotePath}'.`);
  }

  // Traversal check
  if (/\/\.\.\/|\/\.\.$|^\.\.\//.test(fullRemotePath)) {
    throw new Error(`[ONEDRIVE GUARD ABORT] Path Traversal ('..') in '${fullRemotePath}' erkannt.`);
  }

  // Strictly validate testRunId format
  if (!validateTestRunId(testRunId)) {
    throw new Error(`[ONEDRIVE GUARD ABORT] Ungültiges testRunId Format: '${testRunId}'.`);
  }

  // Split into segments
  const segments = fullRemotePath.split('/');

  if (segments.length < 3 || segments.length > 5) {
    throw new Error(`[ONEDRIVE GUARD ABORT] Pfadtiefe von ${segments.length} Segmenten nicht im zulässigen Schema (3 bis 5 Segmente).`);
  }

  // Segment 0: MUST be QTool_TEST_ONLY
  if (segments[0] !== EXPECTED_TEST_ROOT) {
    throw new Error(`[ONEDRIVE GUARD ABORT] Stammordner muss exakt '${EXPECTED_TEST_ROOT}' sein, erhalten: '${segments[0]}'.`);
  }

  // Segment 1: MUST match testRunId
  if (segments[1] !== testRunId) {
    throw new Error(`[ONEDRIVE GUARD ABORT] Testlauf-Ordner '${segments[1]}' entspricht nicht der übergebenen testRunId '${testRunId}'.`);
  }

  // Segment 2: Manifest file directly under testRunId OR project folder
  if (segments.length === 3) {
    if (segments[2] !== 'TEST_MANIFEST.json') {
      throw new Error(`[ONEDRIVE GUARD ABORT] Direkt im Testlauf-Ordner ist nur 'TEST_MANIFEST.json' erlaubt, erhalten: '${segments[2]}'.`);
    }
    validatePathSegment(segments[2], { allowManifest: true });
    return true;
  }

  // Segment 2: Project folder (must start with TEST__)
  validatePathSegment(segments[2], { isProjectFolder: true });

  // Segment 3: Subfolder (Fotos, Dokumente, Messprotokolle, Manifest) OR file
  if (segments.length === 4) {
    validatePathSegment(segments[3], { isFileName: true });
    return true;
  }

  // Segment 3: Subfolder
  if (!ALLOWED_SUBFOLDERS.has(segments[3])) {
    throw new Error(`[ONEDRIVE GUARD ABORT] Unzulässiger Unterordner '${segments[3]}'. Erlaubt sind: ${Array.from(ALLOWED_SUBFOLDERS).join(', ')}.`);
  }
  validatePathSegment(segments[3]);

  // Segment 4: File name (must start with TEST__)
  validatePathSegment(segments[4], { isFileName: true });

  return true;
}

/**
 * Validates target item for safe cleanup dry-run / deletion.
 * @param {string} testRunId
 * @param {string} targetFolderPath
 * @param {string} targetItemId
 */
export function validateCleanupTarget(testRunId, targetFolderPath, targetItemId) {
  if (!validateTestRunId(testRunId)) {
    throw new Error(`[CLEANUP GUARD ABORT] Ungültiges testRunId Format: '${testRunId}'.`);
  }

  if (!targetItemId || typeof targetItemId !== 'string' || targetItemId.trim() === '') {
    throw new Error('[CLEANUP GUARD ABORT] Ziel-ItemId fehlt.');
  }

  const expectedPath = `${EXPECTED_TEST_ROOT}/${testRunId}`;
  if (targetFolderPath !== expectedPath) {
    throw new Error(`[CLEANUP GUARD ABORT] Löschziel '${targetFolderPath}' entspricht nicht exakt dem Testlauf-Pfad '${expectedPath}'.`);
  }

  if (targetFolderPath.includes('QTool/') && !targetFolderPath.includes(EXPECTED_TEST_ROOT)) {
    throw new Error('[CLEANUP GUARD ABORT] KRITISCHER SICHERHEITSFEHLER: Versuchte Löschung eines Live-QTool-Ordners!');
  }

  return true;
}
