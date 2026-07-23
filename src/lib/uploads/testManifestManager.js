/**
 * testManifestManager.js
 * In-Memory & Serialized Manifest Manager for QTool Test Runs.
 * Supports optimistic concurrency control via ETag for OneDrive updates.
 */

import { EXPECTED_TEST_ROOT, validateTestRunId } from './oneDriveTestGuard.js';

export class TestManifestManager {
  /**
   * @param {object} params
   * @param {string} params.testRunId
   * @param {string} [params.supabaseProjectId]
   * @param {string} [params.createdByTestAccount]
   * @param {string} [params.driveId]
   */
  constructor({ testRunId, supabaseProjectId = 'test_project', createdByTestAccount = 'qtool.test@local', driveId = 'test_drive' }) {
    if (!validateTestRunId(testRunId)) {
      throw new Error(`[MANIFEST MANAGER ABORT] Ungültiges testRunId Format: '${testRunId}'.`);
    }

    this.manifest = {
      schemaVersion: '1.0',
      environment: 'QTool-Test',
      testRunId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByTestAccount,
      driveId: driveId.slice(0, 16), // shortened, no sensitive credentials
      testRootItemId: '',
      testRunFolderItemId: '',
      supabaseProjectId,
      generatedProjectsCount: 0,
      uploadedFilesCount: 0,
      totalSizeBytes: 0,
      files: []
    };

    this.eTag = null; // Used for Microsoft Graph If-Match header
  }

  /**
   * Adds or updates a file record in the manifest atomically.
   * @param {object} fileRecord
   */
  addFileRecord({ relativePath, itemId, parentItemId, sizeBytes, mimeType, sha256, remoteEtag, uploadStatus = 'remote_verified' }) {
    if (!relativePath || !itemId) {
      throw new Error('[MANIFEST MANAGER ABORT] relativePath und itemId sind erforderlich.');
    }

    // Check if file already recorded (prevent duplicates)
    const existingIndex = this.manifest.files.findIndex(f => f.relativePath === relativePath || f.itemId === itemId);

    const record = {
      relativePath,
      itemId,
      parentItemId: parentItemId || '',
      sizeBytes: Number(sizeBytes) || 0,
      mimeType: mimeType || 'application/octet-stream',
      sha256: sha256 || '',
      uploadedAt: new Date().toISOString(),
      uploadStatus,
      remoteEtag: remoteEtag || ''
    };

    if (existingIndex >= 0) {
      // Adjust total size by delta
      const oldSize = this.manifest.files[existingIndex].sizeBytes;
      this.manifest.totalSizeBytes += (record.sizeBytes - oldSize);
      this.manifest.files[existingIndex] = record;
    } else {
      this.manifest.files.push(record);
      this.manifest.uploadedFilesCount += 1;
      this.manifest.totalSizeBytes += record.sizeBytes;
    }

    // Update project count dynamically from unique project folders
    const projectFolders = new Set(
      this.manifest.files.map(f => f.relativePath.split('/')[0]).filter(p => p.startsWith('TEST__'))
    );
    this.manifest.generatedProjectsCount = projectFolders.size;
    this.manifest.updatedAt = new Date().toISOString();
  }

  /**
   * Returns serialised JSON content for saving to TEST_MANIFEST.json.
   * @returns {string} JSON String
   */
  toManifestJson() {
    return JSON.stringify(this.manifest, null, 2);
  }

  /**
   * Merges remote manifest state with local state (resolving parallel updates).
   * @param {string} remoteJson
   * @param {string} [newETag]
   */
  mergeRemoteManifest(remoteJson, newETag) {
    try {
      const remote = JSON.parse(remoteJson);
      if (remote.testRunId !== this.manifest.testRunId) {
        throw new Error('testRunId Mismatch bei Manifest-Merge');
      }

      // Merge files maps by relativePath
      const fileMap = new Map();
      this.manifest.files.forEach(f => fileMap.set(f.relativePath, f));
      (remote.files || []).forEach(f => fileMap.set(f.relativePath, f));

      this.manifest.files = Array.from(fileMap.values());
      this.manifest.uploadedFilesCount = this.manifest.files.length;
      this.manifest.totalSizeBytes = this.manifest.files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
      this.manifest.updatedAt = new Date().toISOString();
      
      if (newETag) this.eTag = newETag;
    } catch (err) {
      throw new Error(`[MANIFEST MANAGER ABORT] Remote Manifest Merge fehlgeschlagen: ${err.message}`);
    }
  }

  /**
   * Simulates/executes the ETag & If-Match HTTP 412 retry workflow for saving TEST_MANIFEST.json.
   *
   * @param {Function} fetchRemoteManifestFn () => Promise<{json: string, eTag: string}>
   * @param {Function} writeManifestFn (jsonContent: string, matchETag: string|null) => Promise<{ok: boolean, status: number, newETag?: string}>
   * @param {number} [maxRetries=3]
   * @returns {Promise<{success: boolean, retriesUsed: number, finalETag: string}>}
   */
  async syncWithGraphOptimistic(fetchRemoteManifestFn, writeManifestFn, maxRetries = 3) {
    let attempts = 0;

    while (attempts < maxRetries) {
      attempts++;
      try {
        const payload = this.toManifestJson();
        const res = await writeManifestFn(payload, this.eTag);

        if (res.ok) {
          if (res.newETag) this.eTag = res.newETag;
          return { success: true, retriesUsed: attempts - 1, finalETag: this.eTag || '' };
        }

        // HTTP 412 Precondition Failed -> ETag Conflict!
        if (res.status === 412) {
          console.warn(`[MANIFEST ETAG CONFLICET] HTTP 412 bei Versuch ${attempts}. Lese remote Manifest neu...`);
          const remoteData = await fetchRemoteManifestFn();
          if (remoteData && remoteData.json) {
            this.mergeRemoteManifest(remoteData.json, remoteData.eTag);
          }
          continue; // Retry write with merged state and new eTag
        }

        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        if (attempts >= maxRetries) {
          throw new Error(`[MANIFEST ETAG SYNC FAILED] Manifest konnte nach ${maxRetries} Versuchen nicht synchronisiert werden: ${err.message}`);
        }
      }
    }

    throw new Error(`[MANIFEST ETAG SYNC FAILED] Max Retries (${maxRetries}) überschritten.`);
  }
}
