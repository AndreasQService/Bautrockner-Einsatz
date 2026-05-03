/**
 * db.js
 * IndexedDB-Abstraktionsschicht für die durable Upload-Queue
 *
 * Zwei Object Stores:
 *   uploadItems  – Metadaten + Status pro Bild (keyPath: 'id')
 *   uploadBlobs  – Rohdaten (Blob) pro Bild   (key: id, value: Blob)
 *
 * WICHTIG: Blobs werden GETRENNT von Metadaten gespeichert.
 * Das erhöht die Performance beim Lesen von Metadaten erheblich.
 */

import { openDB as openIDB } from 'idb';

const DB_NAME    = 'qtool-upload-db';
const DB_VERSION = 1;

/** Singleton-Versprechen – wird einmal aufgelöst und dann gecacht */
let _dbPromise = null;

export function getDbPromise() {
  if (!_dbPromise) {
    _dbPromise = openIDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // ─── uploadItems ────────────────────────────────────────────────────
        if (!db.objectStoreNames.contains('uploadItems')) {
          const store = db.createObjectStore('uploadItems', { keyPath: 'id' });
          store.createIndex('by_status',    'status',    { unique: false });
          store.createIndex('by_projectId', 'projectId', { unique: false });
        }

        // ─── uploadBlobs ────────────────────────────────────────────────────
        if (!db.objectStoreNames.contains('uploadBlobs')) {
          db.createObjectStore('uploadBlobs');
        }
      },
    });
  }
  return _dbPromise;
}

// ─── UploadItem CRUD ─────────────────────────────────────────────────────────

/**
 * Speichert oder überschreibt ein UploadItem (upsert)
 * @param {import('./queueTypes').UploadItem} item
 */
export async function putUploadItem(item) {
  const db = await getDbPromise();
  await db.put('uploadItems', item);
}

/**
 * Lädt ein einzelnes UploadItem per ID
 * @param {string} id
 * @returns {Promise<import('./queueTypes').UploadItem|undefined>}
 */
export async function getUploadItem(id) {
  const db = await getDbPromise();
  return db.get('uploadItems', id);
}

/**
 * Löscht ein UploadItem aus der DB (nur nach Verifikation + Aufbewahrungsfrist!)
 * @param {string} id
 */
export async function deleteUploadItem(id) {
  const db = await getDbPromise();
  await db.delete('uploadItems', id);
}

/**
 * Alle UploadItems laden (alle Status)
 * @returns {Promise<import('./queueTypes').UploadItem[]>}
 */
export async function getAllUploadItems() {
  const db = await getDbPromise();
  return db.getAll('uploadItems');
}

/**
 * Alle UploadItems eines Projekts laden
 * @param {string} projectId
 * @returns {Promise<import('./queueTypes').UploadItem[]>}
 */
export async function getItemsByProject(projectId) {
  const db = await getDbPromise();
  return db.getAllFromIndex('uploadItems', 'by_projectId', projectId);
}

/**
 * Alle "ausstehenden" Items laden (die noch bearbeitet werden müssen)
 * Status: queued | persisted | creating_session | uploading | pending_resume |
 *         uploaded_unverified | needs_repair | failed
 * @returns {Promise<import('./queueTypes').UploadItem[]>}
 */
export async function getPendingItems() {
  const db = await getDbPromise();
  const all = await db.getAll('uploadItems');

  const PENDING = [
    'queued',
    'persisted',
    'creating_session',
    'uploading',
    'pending_resume',
    'uploaded_unverified',
    'needs_repair',
    'failed',
  ];

  return all.filter((i) => PENDING.includes(i.status));
}

/**
 * Items nach Status laden
 * @param {import('./queueTypes').UploadStatus} status
 * @returns {Promise<import('./queueTypes').UploadItem[]>}
 */
export async function getItemsByStatus(status) {
  const db = await getDbPromise();
  return db.getAllFromIndex('uploadItems', 'by_status', status);
}

// ─── Blob CRUD ───────────────────────────────────────────────────────────────

/**
 * Blob dauerhaft in IndexedDB speichern
 * @param {string} id
 * @param {Blob}   blob
 */
export async function putUploadBlob(id, blob) {
  const db = await getDbPromise();
  await db.put('uploadBlobs', blob, id);
}

/**
 * Blob aus IndexedDB laden
 * @param {string} id
 * @returns {Promise<Blob|undefined>}
 */
export async function getUploadBlob(id) {
  const db = await getDbPromise();
  return db.get('uploadBlobs', id);
}

/**
 * Blob aus IndexedDB löschen (NUR nach verified + Aufbewahrungsfrist!)
 * @param {string} id
 */
export async function deleteUploadBlob(id) {
  const db = await getDbPromise();
  await db.delete('uploadBlobs', id);
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

/**
 * Bereinigt verified Items + Blobs, die älter als olderThanDays Tage sind.
 * Wird NIEMALS auf nicht-verifizierten Items ausgeführt.
 * @param {number} olderThanDays  Standard: 30 Tage
 * @returns {Promise<number>}     Anzahl gelöschter Einträge
 */
export async function cleanupVerifiedOld(olderThanDays = 30) {
  const db = await getDbPromise();
  const all = await db.getAll('uploadItems');
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  let count = 0;
  for (const item of all) {
    if (item.status !== 'verified') continue;
    if (!item.remoteItemId)         continue; // doppelte Sicherheit
    const createdMs = new Date(item.createdAt).getTime();
    if (createdMs > cutoff)         continue;

    await db.delete('uploadItems', item.id);
    await db.delete('uploadBlobs', item.id);
    count++;
  }

  if (count > 0) {
    console.info(`[UploadDB] 🗑️ ${count} verifizierte Einträge bereinigt (>${olderThanDays} Tage)`);
  }
  return count;
}
