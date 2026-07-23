import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCleanupTarget, validateTestRunId } from '../src/lib/uploads/oneDriveTestGuard.js';

// Simulated Graph Mock Runner for Cleanup Scenarios
function mockGraphDryRun(testRunId, targetFolderPath, targetItemId, mockDriveItems, mockManifest, driveId = 'drive_test') {
  const httpLog = [];

  // Step 1: Validate Cleanup Target
  validateCleanupTarget(testRunId, targetFolderPath, targetItemId);

  // Step 2: GET Folder Metadata
  httpLog.push({ method: 'GET', url: `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${targetFolderPath}` });

  // Step 3: GET Children (Simulating pagination if nextLink exists)
  httpLog.push({ method: 'GET', url: `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${targetFolderPath}:/children` });
  
  if (mockDriveItems && mockDriveItems.length > 5) {
    httpLog.push({ method: 'GET', url: `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${targetFolderPath}:/children?@odata.nextLink=token` });
  }

  const foundManifest = mockDriveItems.some(i => i.name === 'TEST_MANIFEST.json');
  const discrepancies = [];

  if (mockManifest) {
    // Check for live path in manifest
    if (mockManifest.rootFolder && mockManifest.rootFolder.includes('QTool/') && !mockManifest.rootFolder.includes('QTool_TEST_ONLY')) {
      throw new Error('[CLEANUP GUARD ABORT] Live-Pfad im Manifest erkannt!');
    }

    mockManifest.files.forEach(mf => {
      const exists = mockDriveItems.some(di => di.name === mf.relativePath.split('/').pop());
      if (!exists) discrepancies.push(`Manifest Datei '${mf.relativePath}' fehlt auf OneDrive.`);
    });
  }

  // Check for extra items on OneDrive not in manifest
  if (mockManifest) {
    mockDriveItems.forEach(di => {
      if (di.name !== 'TEST_MANIFEST.json') {
        const inManifest = mockManifest.files.some(mf => mf.relativePath.endsWith(di.name));
        if (!inManifest) discrepancies.push(`OneDrive Datei '${di.name}' nicht im Manifest enthalten.`);
      }
    });
  }

  return {
    testRunId,
    targetFolderPath,
    targetItemId,
    httpLog,
    fileCount: mockDriveItems.filter(i => !i.folder).length,
    manifestFound: foundManifest,
    discrepancies,
    hasWriteOrDeleteRequests: httpLog.some(req => req.method !== 'GET')
  };
}

test('Dry-Run 1: Valid Test Run with Manifest', () => {
  const res = mockGraphDryRun('TESTRUN_2026-07-21_143000_A7K2', 'QTool_TEST_ONLY/TESTRUN_2026-07-21_143000_A7K2', 'item_123', [
    { name: 'TEST_MANIFEST.json', folder: false },
    { name: 'TEST__bild1.jpg', folder: false }
  ], { files: [{ relativePath: 'TEST__P01/Fotos/TEST__bild1.jpg' }] });

  assert.equal(res.manifestFound, true);
  assert.equal(res.hasWriteOrDeleteRequests, false);
  assert.equal(res.httpLog.every(r => r.method === 'GET'), true);
});

test('Dry-Run 2: Missing Manifest', () => {
  const res = mockGraphDryRun('TESTRUN_2026-07-21_143000_A7K2', 'QTool_TEST_ONLY/TESTRUN_2026-07-21_143000_A7K2', 'item_123', [
    { name: 'TEST__bild1.jpg', folder: false }
  ], null);

  assert.equal(res.manifestFound, false);
  assert.equal(res.hasWriteOrDeleteRequests, false);
});

test('Dry-Run 3: Discrepancy (Manifest file missing on OneDrive)', () => {
  const res = mockGraphDryRun('TESTRUN_2026-07-21_143000_A7K2', 'QTool_TEST_ONLY/TESTRUN_2026-07-21_143000_A7K2', 'item_123', [], {
    files: [{ relativePath: 'TEST__P01/Fotos/TEST__bild1.jpg' }]
  });

  assert.equal(res.discrepancies.length, 1);
});

test('Dry-Run 4: Discrepancy (Extra file on OneDrive not in Manifest)', () => {
  const res = mockGraphDryRun('TESTRUN_2026-07-21_143000_A7K2', 'QTool_TEST_ONLY/TESTRUN_2026-07-21_143000_A7K2', 'item_123', [
    { name: 'TEST_MANIFEST.json', folder: false },
    { name: 'TEST__extra.jpg', folder: false }
  ], { files: [] });

  assert.equal(res.discrepancies.length, 1);
});

test('Dry-Run 5: Block Folder under QTool instead of QTool_TEST_ONLY', () => {
  assert.throws(() => {
    mockGraphDryRun('TESTRUN_2026-07-21_143000_A7K2', 'QTool/TESTRUN_2026-07-21_143000_A7K2', 'item_123', [], null);
  }, /Löschziel/);
});

test('Dry-Run 6: Block Root QTool_TEST_ONLY Deletion Target', () => {
  assert.throws(() => {
    mockGraphDryRun('TESTRUN_2026-07-21_143000_A7K2', 'QTool_TEST_ONLY', 'item_123', [], null);
  }, /Löschziel/);
});

test('Dry-Run 7: Block Missing ItemId', () => {
  assert.throws(() => {
    mockGraphDryRun('TESTRUN_2026-07-21_143000_A7K2', 'QTool_TEST_ONLY/TESTRUN_2026-07-21_143000_A7K2', '', [], null);
  }, /Ziel-ItemId fehlt/);
});

test('Dry-Run 8: Manifest with Live-Path Detection', () => {
  assert.throws(() => {
    mockGraphDryRun('TESTRUN_2026-07-21_143000_A7K2', 'QTool_TEST_ONLY/TESTRUN_2026-07-21_143000_A7K2', 'item_123', [], {
      rootFolder: 'QTool/20260236_Muster',
      files: []
    });
  }, /Live-Pfad im Manifest/);
});

test('Dry-Run 9: Pagination via nextLink', () => {
  const items = Array.from({ length: 8 }, (_, i) => ({ name: `TEST__file${i}.jpg`, folder: false }));
  const res = mockGraphDryRun('TESTRUN_2026-07-21_143000_A7K2', 'QTool_TEST_ONLY/TESTRUN_2026-07-21_143000_A7K2', 'item_123', items, null);

  assert.equal(res.httpLog.length, 3);
  assert.equal(res.httpLog.every(r => r.method === 'GET'), true);
});
