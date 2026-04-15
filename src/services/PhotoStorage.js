/**
 * PhotoStorage.js
 * IndexedDB-basierter Foto-Speicher für Offline-Betrieb
 *
 * Fotos werden SOFORT lokal gespeichert (unabhängig vom Netz).
 * Wenn Netz verfügbar: automatisch zu OneDrive + Supabase hochladen.
 * Wenn kein Netz: Fotos bleiben in IndexedDB bis Sync möglich ist.
 */

const DB_NAME = 'qtool-photos';
const DB_VERSION = 1;
const STORE_PHOTOS = 'photos';
const STORE_QUEUE = 'upload-queue';

let _db = null;

/**
 * IndexedDB öffnen / initialisieren
 */
export async function openDB() {
    if (_db) return _db;

    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Fotos: Blob + Metadaten
            if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
                const store = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
                store.createIndex('projectId', 'projectId', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }

            // Upload-Queue: Einträge die noch hochgeladen werden müssen
            if (!db.objectStoreNames.contains(STORE_QUEUE)) {
                const queue = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
                queue.createIndex('projectId', 'projectId', { unique: false });
                queue.createIndex('status', 'status', { unique: false });
            }
        };

        req.onsuccess = () => { _db = req.result; resolve(_db); };
        req.onerror = () => reject(req.error);
    });
}

/**
 * Foto lokal speichern (immer, sofort, kein Netz nötig)
 * @param {string} photoId     Eindeutige ID (z.B. tempId aus DamageForm)
 * @param {string} projectId   Projekt-ID
 * @param {File|Blob} file     Das Foto
 * @param {object} meta        Zusätzliche Metadaten (roomName, subFolder, etc.)
 * @returns {string}           Lokale blob-URL für sofortige Anzeige
 */
export async function savePhotoLocally(photoId, projectId, file, meta = {}) {
    const db = await openDB();

    const entry = {
        id: photoId,
        projectId,
        blob: file,
        name: file.name,
        type: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
        meta,
        // Upload-Status
        supabasePath: null,
        oneDrivePath: null,
        oneDriveItemId: null,
        syncStatus: 'pending', // 'pending' | 'uploading' | 'synced' | 'error'
    };

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readwrite');
        tx.objectStore(STORE_PHOTOS).put(entry);
        tx.oncomplete = () => {
            console.log(`[PhotoStorage] 📸 Foto lokal gesichert: ${photoId}`);
            resolve(URL.createObjectURL(file));
        };
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Foto nach erfolgreichem Cloud-Upload aktualisieren
 */
export async function updatePhotoSyncStatus(photoId, updates) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readwrite');
        const store = tx.objectStore(STORE_PHOTOS);
        const req = store.get(photoId);
        req.onsuccess = () => {
            const entry = req.result;
            if (entry) {
                const updated = { ...entry, ...updates };
                store.put(updated);
            }
            resolve();
        };
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Alle pending Fotos eines Projekts laden (für Sync)
 */
export async function getPendingPhotos(projectId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readonly');
        const store = tx.objectStore(STORE_PHOTOS);
        const index = store.index('projectId');
        const req = index.getAll(projectId);
        req.onsuccess = () => {
            const all = req.result || [];
            resolve(all.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'error'));
        };
        req.onerror = () => reject(req.error);
    });
}

/**
 * Foto-Blob aus IndexedDB laden (für Anzeige nach Neustart)
 */
export async function getPhotoBlob(photoId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readonly');
        const req = tx.objectStore(STORE_PHOTOS).get(photoId);
        req.onsuccess = () => {
            const entry = req.result;
            if (entry?.blob) {
                resolve(URL.createObjectURL(entry.blob));
            } else {
                resolve(null);
            }
        };
        req.onerror = () => reject(req.error);
    });
}

/**
 * Alle Fotos eines Projekts laden
 */
export async function getProjectPhotos(projectId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readonly');
        const index = tx.objectStore(STORE_PHOTOS).index('projectId');
        const req = index.getAll(projectId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Foto löschen (nach erfolgreichem Sync + 30 Tage Sicherheitsfrist)
 */
export async function deleteOldSyncedPhotos(olderThanDays = 30) {
    const db = await openDB();
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readwrite');
        const store = tx.objectStore(STORE_PHOTOS);
        const index = store.index('createdAt');
        const req = index.openCursor(IDBKeyRange.upperBound(cutoff));
        let count = 0;

        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const entry = cursor.value;
                // Nur löschen wenn auf OneDrive gesichert
                if (entry.syncStatus === 'synced' && entry.oneDriveItemId) {
                    cursor.delete();
                    count++;
                }
                cursor.continue();
            } else {
                if (count > 0) console.log(`[PhotoStorage] 🗑️ ${count} alte Fotos aus IndexedDB bereinigt`);
                resolve(count);
            }
        };
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Anzahl pending (nicht hochgeladener) Fotos
 */
export async function getPendingCount() {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_PHOTOS, 'readonly');
        const store = tx.objectStore(STORE_PHOTOS);
        const req = store.getAll();
        req.onsuccess = () => {
            const pending = (req.result || []).filter(p => p.syncStatus === 'pending' || p.syncStatus === 'error');
            resolve(pending.length);
        };
        req.onerror = () => resolve(0);
    });
}
