/**
 * queueRepository.js
 * Schreibt Dateien ZUERST lokal (IndexedDB) bevor sie in die Queue kommen.
 *
 * Reihenfolge je Datei:
 *   1. status = 'persisting'  → Metadaten angelegt
 *   2. Blob in IndexedDB gespeichert
 *   3. SHA-256 berechnet
 *   4. status = 'persisted'   → Blob dauerhaft gesichert
 *
 * Erst danach darf der Upload beginnen.
 * Kein Bild wird in die Queue genommen, bevor es lokal gesichert ist.
 */

import { v4 as uuidv4 } from 'uuid';
import { putUploadBlob, putUploadItem } from './db.js';
import { sha256OfBlob }                from './hash.js';
import { buildTestRemotePath }        from './oneDrivePathBuilder.js';
import { applyTestWatermark }         from './testWatermark.js';

/**
 * Wandelt einen Dateinamen in einen sicheren String ohne Sonderzeichen um.
 * @param {string} name
 * @returns {string}
 */
function sanitizeFilename(name) {
  return name
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/, '');
}

/**
 * Nimmt ein Array von Files entgegen, speichert jeden Blob dauerhaft in
 * IndexedDB und legt die Queue-Einträge an.
 *
 * @param {string}   projectId       Projekt-ID
 * @param {File[]}   files           Die ausgewählten Dateien
 * @param {string}   remoteBasePath  OneDrive-Zielpfad oder testRunId
 * @param {Function} [onProgress]    Optionaler Callback (completedIndex, total, item)
 * @param {string}   [testRunId]     Optionale explicit testRunId
 * @returns {Promise<import('./queueTypes').UploadItem[]>}
 */
export async function enqueueFiles(projectId, files, remoteBasePath, onProgress, testRunId) {
  const created = [];
  const now = () => new Date().toISOString();

  // If testRunId is passed or embedded, build strictly isolated test remote path
  const activeTestRunId = testRunId || (remoteBasePath?.startsWith('TESTRUN_') ? remoteBasePath : null);

  for (let i = 0; i < files.length; i++) {
    let file = files[i];

    // HEIC Blockade
    const fileNameLower = file.name.toLowerCase();
    if (file.type === 'image/heic' || file.type === 'image/heif' || fileNameLower.endsWith('.heic') || fileNameLower.endsWith('.heif')) {
      throw new Error(`[HEIC BLOCKED] HEIC-Datei '${file.name}' im ersten OneDrive-Test nicht zugelassen.`);
    }

    // Wasserzeichen anwenden (falls Bild)
    if (activeTestRunId && (file.type?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name))) {
      file = await applyTestWatermark(file, file.name);
    }

    const id   = uuidv4();

    let remotePath;
    let remoteFileName;

    if (activeTestRunId) {
      remotePath = buildTestRemotePath({
        testRunId: activeTestRunId,
        projectId,
        subfolder: 'Fotos',
        originalFileName: file.name,
        fileIndex: i
      });
      const pathParts = remotePath.split('/');
      remoteFileName = pathParts[pathParts.length - 1];
    } else {
      // Direct validation check if using legacy parameter syntax
      if (remoteBasePath?.includes('QTool/') && !remoteBasePath?.includes('QTool_TEST_ONLY')) {
        throw new Error(`[QUEUE REPOSITORY ABORT] Produktiver Pfad '${remoteBasePath}' in Testumgebung verboten!`);
      }
      const safeName      = sanitizeFilename(file.name);
      const ext           = safeName.includes('.') ? '' : '.jpg';
      remoteFileName = `${projectId}_${Date.now()}_${i}_${safeName}${ext}`;
      remotePath    = `${remoteBasePath}/${remoteFileName}`;
    }

    /** @type {import('./queueTypes').UploadItem} */
    const item = {
      id,
      projectId,
      originalName:  file.name,
      remoteFileName,
      remotePath,
      mimeType:      file.type || 'application/octet-stream',
      size:          file.size,
      sha256:        '',           // wird gleich befüllt
      createdAt:     now(),
      updatedAt:     now(),
      status:        'persisting', // ← Blob wird gerade gespeichert
      retryCount:    0,
      bytesUploaded: 0,
    };

    // Schritt 1: Metadaten sofort persistieren (Status: persisting)
    await putUploadItem(item);

    try {
      // Schritt 2: Blob sichern
      await putUploadBlob(id, file);

      // Schritt 3: Hash berechnen (Integritätsprüfung)
      const sha256 = await sha256OfBlob(file);

      // Schritt 4: Status auf 'persisted' setzen
      const persisted = {
        ...item,
        sha256,
        status:    'persisted',
        updatedAt: now(),
      };

      await putUploadItem(persisted);
      created.push(persisted);

      onProgress?.(i + 1, files.length, persisted);

    } catch (err) {
      // Blob konnte nicht gespeichert werden → 'failed' mit Fehlermeldung
      const failed = {
        ...item,
        status:       'failed',
        errorMessage: `Lokale Persistierung fehlgeschlagen: ${err.message}`,
        updatedAt:    now(),
      };
      await putUploadItem(failed);
      created.push(failed);

      console.error(`[Queue] ❌ Persistierung von ${file.name} fehlgeschlagen:`, err);
      onProgress?.(i + 1, files.length, failed);
    }
  }

  return created;
}
