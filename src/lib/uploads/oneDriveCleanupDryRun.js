/**
 * oneDriveCleanupDryRun.js
 * Safe Dry-Run Cleanup verification tool for QTool Test Runs.
 * Performs deep path, parent chain, and manifest verification WITHOUT executing deletion.
 */

import { EXPECTED_TEST_ROOT, validateTestRunId, validateCleanupTarget } from './oneDriveTestGuard.js';
import { listFolderChildren, itemExists } from './oneDriveApi.js';

/**
 * Executes a Dry-Run scan of a test run folder on OneDrive.
 * DOES NOT DELETE ANYTHING.
 *
 * @param {string} testRunId e.g. "TESTRUN_2026-07-21_143000_A7K2"
 * @returns {Promise<object>} Dry-Run Report
 */
export async function runCleanupDryRun(testRunId) {
  // 1. Strict testRunId check
  if (!validateTestRunId(testRunId)) {
    throw new Error(`[DRY-RUN ABORT] Ungültiges testRunId Format: '${testRunId}'.`);
  }

  const targetFolderPath = `${EXPECTED_TEST_ROOT}/${testRunId}`;

  // 2. Perform path & isolation checks
  validateCleanupTarget(testRunId, targetFolderPath, 'PENDING_SCAN_ITEM_ID');

  console.log(`[DRY-RUN] 🔍 Scanne Testlauf-Ordner: '${targetFolderPath}'...`);

  // 3. Folder enumeration via Graph API (read-only)
  const remoteChildren = await listFolderChildren(targetFolderPath);

  if (!remoteChildren || remoteChildren.length === 0) {
    return {
      testRunId,
      targetFolderPath,
      status: 'NOT_FOUND_OR_EMPTY',
      fileCount: 0,
      folderCount: 0,
      totalSizeBytes: 0,
      items: [],
      manifestMatch: false,
      warnings: ['Keine Dateien oder Manifest im Ordner gefunden.']
    };
  }

  let fileCount = 0;
  let folderCount = 0;
  let totalSizeBytes = 0;
  const itemsList = [];

  for (const child of remoteChildren) {
    if (child.folder) {
      folderCount++;
    } else {
      fileCount++;
      totalSizeBytes += child.size || 0;
    }
    itemsList.push({
      id: child.id,
      name: child.name,
      size: child.size,
      eTag: child.eTag,
      path: `${targetFolderPath}/${child.name}`
    });
  }

  const report = {
    testRunId,
    targetFolderPath,
    status: 'DRY_RUN_COMPLETED',
    fileCount,
    folderCount,
    totalSizeBytes,
    totalSizeMB: (totalSizeBytes / (1024 * 1024)).toFixed(2),
    items: itemsList,
    manifestMatch: itemsList.some(i => i.name === 'TEST_MANIFEST.json'),
    safetyCheck: {
      isTestRoot: targetFolderPath.startsWith(`${EXPECTED_TEST_ROOT}/TESTRUN_`),
      livePathProtected: !targetFolderPath.includes('QTool/') || targetFolderPath.includes(EXPECTED_TEST_ROOT)
    }
  };

  console.log(`[DRY-RUN] ✅ Scan abgeschlossen. ${fileCount} Dateien, ${folderCount} Ordner, Gesamtlänge: ${report.totalSizeMB} MB.`);
  return report;
}
