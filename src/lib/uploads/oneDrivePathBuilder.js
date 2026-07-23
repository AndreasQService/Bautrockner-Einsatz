/**
 * oneDrivePathBuilder.js
 * Central path generator for QTool Test Environment.
 * Strictly guarantees synthetic naming and validates all paths before enqueueing.
 */

import { EXPECTED_TEST_ROOT, validateOneDrivePath, validateTestRunId } from './oneDriveTestGuard.js';

/**
 * Builds a validated, synthetic remote path for test uploads.
 *
 * @param {object} params
 * @param {string} params.testRunId       e.g. "TESTRUN_2026-07-21_143000_A7K2"
 * @param {string} params.projectId       Project ID or string
 * @param {string} [params.subfolder]     "Fotos" | "Dokumente" | "Messprotokolle" | "Manifest"
 * @param {string} params.originalFileName e.g. "foto1.jpg"
 * @param {number} [params.fileIndex]     Index for uniqueness
 * @returns {string} Full validated remote path
 */
export function buildTestRemotePath({ testRunId, projectId, subfolder = 'Fotos', originalFileName, fileIndex = 0 }) {
  if (!validateTestRunId(testRunId)) {
    throw new Error(`[PATH BUILDER ABORT] Ungültige oder fehlende testRunId: '${testRunId}'.`);
  }

  // Generate synthetic project ID (NEVER use real client names or addresses)
  const cleanProjectId = String(projectId || 'P000').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 12);
  const syntheticProjectFolder = `TEST__PROJ_${cleanProjectId}`;

  // Sanitize and prefix file name
  const extMatch = originalFileName.match(/\.[a-zA-Z0-9]+$/);
  const ext = extMatch ? extMatch[0].toLowerCase() : '.jpg';
  const baseNameWithoutExt = originalFileName.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
  
  const syntheticFileName = `TEST__${Date.now()}_${fileIndex}_${baseNameWithoutExt}${ext}`;

  // Assemble path according to schema: QTool_TEST_ONLY / TESTRUN_... / TEST__... / subfolder / TEST__...
  const fullRemotePath = `${EXPECTED_TEST_ROOT}/${testRunId}/${syntheticProjectFolder}/${subfolder}/${syntheticFileName}`;

  // Validate immediately before returning
  validateOneDrivePath(fullRemotePath, testRunId);

  return fullRemotePath;
}
