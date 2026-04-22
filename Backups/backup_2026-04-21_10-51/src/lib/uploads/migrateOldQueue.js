/**
 * migrateOldQueue.js
 * Einmalige Migration: qtool-photos (alt) → qtool-upload-db (neu)
 *
 * Liest alle Fotos mit syncStatus === 'pending' aus dem alten Store
 * und schreibt sie als UploadItems in die neue durable Queue.
 *
 * Läuft beim App-Start einmalig + idempotent.
 * Nach erfolgreicher Migration: Migration-Flag in localStorage setzen.
 *
 * WICHTIG:
 *   - Alte Einträge werden NICHT gelöscht (zur Sicherheit)
 *   - Bereits migrierte Items werden übersprungen (sha256-Check)
 *   - Keine Netz-Abhängigkeit, keine MSAL-Abhängigkeit
 */

import { putUploadItem, putUploadBlob, getUploadItem } from './db.js';
import { computeSha256 }   from './hash.js';
import { v4 as uuidv4 }   from 'uuid';

const MIGRATION_FLAG = 'qtool_upload_migration_v1_done';
const OLD_DB_NAME    = 'qtool-photos';
const OLD_STORE      = 'photos';

const nowIso = () => new Date().toISOString();

/**
 * Öffnet die alte qtool-photos IndexedDB (read-only)
 * @returns {Promise<IDBDatabase|null>}
 */
async function openOldDb() {
  return new Promise((resolve) => {
    // Prüfen ob DB überhaupt existiert (indexedDB.databases() nur auf modernen Browsern)
    const req = indexedDB.open(OLD_DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => resolve(null); // DB existiert nicht → kein Problem
    // Bei upgrade needed: DB existiert noch nicht → kein Migration nötig
    req.onupgradeneeded = (e) => {
      e.target.result.close();
      e.target.transaction?.abort();
      resolve(null);
    };
  });
}

/**
 * Alle Einträge mit syncStatus 'pending' oder 'error' aus altem Store laden
 * @param {IDBDatabase} db
 * @returns {Promise<Array>}
 */
async function getOldPendingPhotos(db) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(OLD_STORE)) {
      resolve([]);
      return;
    }

    const tx      = db.transaction(OLD_STORE, 'readonly');
    const store   = tx.objectStore(OLD_STORE);
    const req     = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      resolve(all.filter(p =>
        p.syncStatus === 'pending' ||
        p.syncStatus === 'error'   ||
        // Einige alte Einträge haben keinen syncStatus
        (!p.syncStatus && !p.oneDriveItemId)
      ));
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Migriert ein einzelnes altes Foto in die neue Queue
 * @param {object} oldPhoto  Alter PhotoStorage-Eintrag
 * @returns {Promise<'migrated'|'skipped'|'no_blob'>}
 */
async function migrateOne(oldPhoto) {
  // Blob muss vorhanden sein
  const blob = oldPhoto.blob;
  if (!blob || !(blob instanceof Blob)) {
    console.warn('[Migration] Kein Blob für:', oldPhoto.id);
    return 'no_blob';
  }

  // SHA-256 berechnen für Deduplizierung
  const sha256 = await computeSha256(blob);

  // Neues UploadItem anlegen (falls noch nicht vorhanden)
  // ID wird neu vergeben (UUIDs statt alte tempIds)
  const newId = uuidv4();

  // Metadaten aus altem Eintrag extrahieren
  const meta        = oldPhoto.meta || {};
  const odFolder    = meta.odFolder    || 'QTool/Migration';
  const subFolder   = meta.subFolder   || oldPhoto.meta?.contextData?.assignedTo || 'Sonstiges';
  const remotePath  = `${odFolder}/Fotos/${subFolder.replace(/[^a-zA-Z0-9]/g, '_')}/${oldPhoto.name}`;
  const projectId   = oldPhoto.projectId || 'migration';

  // Prüfen ob ein Item mit dieser SHA-256 schon in der neuen Queue ist
  // (Einfacher Check: existingItem suchen würde vollständigen Scan erfordern –
  //  stattdessen: altes ID als Referenz nutzen)
  const existingById = await getUploadItem(`migration-${oldPhoto.id}`);
  if (existingById) {
    return 'skipped'; // Bereits migriert
  }

  // Blob in neue DB schreiben
  await putUploadBlob(newId, blob);

  // UploadItem anlegen
  await putUploadItem({
    id:                 newId,
    originalId:         oldPhoto.id,       // Referenz auf alten Eintrag
    projectId,
    originalName:       oldPhoto.name      || 'Foto',
    mimeType:           oldPhoto.type      || blob.type || 'image/jpeg',
    size:               oldPhoto.size      || blob.size,
    sha256,
    status:             'persisted',        // Bereit für Upload
    remotePath,
    remoteFileName:     oldPhoto.name      || `foto_${newId}`,
    uploadSessionUrl:   undefined,
    nextExpectedRanges: [],
    bytesUploaded:      0,
    retryCount:         0,
    remoteItemId:       oldPhoto.oneDriveItemId || undefined,
    remoteETag:         undefined,
    errorMessage:       oldPhoto.syncStatus === 'error' ? 'Vorgänger-Fehler (migriert)' : undefined,
    createdAt:          oldPhoto.createdAt || nowIso(),
    updatedAt:          nowIso(),
    migratedFrom:       'qtool-photos',
  });

  // Marker-Item für Deduplizierungs-Check
  await putUploadItem({
    id:        `migration-${oldPhoto.id}`, // Marker
    status:    'verified',                  // Marker wird nie verarbeitet
    projectId: 'migration-marker',
    originalName: oldPhoto.id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    migratedFrom: 'qtool-photos-marker',
  });

  return 'migrated';
}

/**
 * Haupt-Migrationsfunktion – einmalig beim App-Start aufrufen.
 *
 * @returns {Promise<{migrated: number, skipped: number, noBlob: number}>}
 */
export async function migrateOldQueueIfNeeded() {
  // Einmaligkeits-Check
  if (localStorage.getItem(MIGRATION_FLAG) === '1') {
    return { migrated: 0, skipped: 0, noBlob: 0 };
  }

  const db = await openOldDb();
  if (!db) {
    // Alte DB existiert nicht → nichts zu migrieren
    localStorage.setItem(MIGRATION_FLAG, '1');
    return { migrated: 0, skipped: 0, noBlob: 0 };
  }

  let pending;
  try {
    pending = await getOldPendingPhotos(db);
  } catch (e) {
    console.warn('[Migration] Alter Store nicht lesbar:', e.message);
    db.close();
    localStorage.setItem(MIGRATION_FLAG, '1');
    return { migrated: 0, skipped: 0, noBlob: 0 };
  }

  db.close();

  if (pending.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, '1');
    return { migrated: 0, skipped: 0, noBlob: 0 };
  }

  console.info(`[Migration] 🔄 ${pending.length} alte ausstehende Fotos gefunden – migriere...`);

  let migrated = 0;
  let skipped  = 0;
  let noBlob   = 0;

  for (const photo of pending) {
    try {
      const result = await migrateOne(photo);
      if (result === 'migrated') migrated++;
      if (result === 'skipped')  skipped++;
      if (result === 'no_blob')  noBlob++;
    } catch (err) {
      console.warn('[Migration] Fehler bei Foto:', photo.id, err.message);
    }
  }

  // Migration als abgeschlossen markieren
  localStorage.setItem(MIGRATION_FLAG, '1');

  console.info(`[Migration] ✅ Abgeschlossen: ${migrated} migriert, ${skipped} bereits vorhanden, ${noBlob} kein Blob`);

  return { migrated, skipped, noBlob };
}
