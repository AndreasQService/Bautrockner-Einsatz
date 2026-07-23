/**
 * PhotoStorage.js
 * IndexedDB-basierter Foto-Speicher für Offline-Betrieb
 *
 * Fotos werden SOFORT lokal gespeichert (unabhängig vom Netz).
 * Wenn Netz verfügbar: automatisch zu OneDrive + Supabase hochladen.
 * Wenn kein Netz: Fotos bleiben in IndexedDB bis Sync möglich ist.
 */

const DB_NAME = 'qtool-photos';
const DB_VERSION = 2;
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

        req.onsuccess = () => { 
            _db = req.result; 
            resolve(_db); 
        };
        req.onerror = () => reject(req.error);
    });
}

/**
 * Foto lokal speichern (immer, sofort, kein Netz nötig)
 * Legt das Original als Blob im Status 'local_only' ab.
 */
export async function savePhotoLocally(photoId, projectId, file, meta = {}) {
    const db = await openDB();

    if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        throw new Error(`IndexedDB Object Store "${STORE_PHOTOS}" wurde nicht gefunden.`);
    }

    const isCloudFirstEnabled = import.meta.env.VITE_CLOUD_FIRST_IMAGES === 'true' || import.meta.env.VITE_CLOUD_FIRST_IMAGES === true;

    const entry = {
        id: photoId,
        projectId,
        blob: file, // Keep root blob for backwards compatibility
        name: file.name,
        type: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
        meta,
        supabasePath: null,
        oneDrivePath: null,
        oneDriveItemId: null,
        syncStatus: isCloudFirstEnabled ? 'local_only' : 'pending', 
        
        // Detailed data model for Cloud-First pipeline
        original: {
            blob: file,
            size: file.size,
            mimeType: file.type,
            sha256: null // will be computed and set on compression
        },
        compressed: null,
        pdf: null,
        preview: null,
        errorMessage: null,
        retryCount: 0
    };

    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(STORE_PHOTOS, 'readwrite');
            tx.objectStore(STORE_PHOTOS).put(entry);
            tx.oncomplete = () => {
                console.log(`[PhotoStorage] 📸 Original-Foto lokal gesichert: ${photoId} (${entry.syncStatus})`);
                resolve(URL.createObjectURL(file));
            };
            tx.onerror = () => reject(tx.error);
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Foto nach erfolgreichem Cloud-Upload aktualisieren
 */
export async function updatePhotoSyncStatus(photoId, updates) {
    const db = await openDB();

    if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        console.warn(`[PhotoStorage] Object Store "${STORE_PHOTOS}" fehlt. Sync-Status-Update übersprungen.`);
        return;
    }

    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(STORE_PHOTOS, 'readwrite');
            const store = tx.objectStore(STORE_PHOTOS);
            const req = store.get(photoId);
            req.onsuccess = () => {
                const entry = req.result;
                if (entry) {
                    // Normalize legacy status mappings
                    if (updates.syncStatus === 'synced') {
                        updates.syncStatus = 'remote_verified';
                    }
                    
                    const updated = { ...entry, ...updates };
                    store.put(updated);
                }
                resolve();
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Alle pending Fotos eines Projekts laden (für Sync).
 */
export async function getPendingPhotos(projectId) {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        return [];
    }

    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(STORE_PHOTOS, 'readonly');
            const store = tx.objectStore(STORE_PHOTOS);
            const index = store.index('projectId');
            const req = index.getAll(projectId);
            req.onsuccess = () => {
                const all = req.result || [];
                resolve(all.filter(p =>
                    p.syncStatus === 'local_only' ||
                    p.syncStatus === 'queued_for_sync' ||
                    p.syncStatus === 'pending' ||
                    p.syncStatus === 'error'   ||
                    p.syncStatus === 'uploaded_to_backend' || // needs OneDrive sync
                    (p.syncStatus === 'synced' && !p.oneDriveItemId) // legacy OneDrive sync missing
                ));
            };
            req.onerror = () => reject(req.error);
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Foto-Blob aus IndexedDB laden (für Anzeige nach Neustart)
 */
export async function getPhotoBlob(photoId, type = 'preview') {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        return null;
    }

    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(STORE_PHOTOS, 'readonly');
            const req = tx.objectStore(STORE_PHOTOS).get(photoId);
            req.onsuccess = () => {
                const entry = req.result;
                if (!entry) { resolve(null); return; }
                
                // Fallback sequence: requested type -> compressed -> original/root blob
                let targetBlob = null;
                if (type && entry[type] && entry[type].blob) {
                    targetBlob = entry[type].blob;
                } else if (entry.compressed && entry.compressed.blob) {
                    targetBlob = entry.compressed.blob;
                } else {
                    targetBlob = entry.blob;
                }
                
                if (targetBlob) {
                    resolve(URL.createObjectURL(targetBlob));
                } else {
                    resolve(null);
                }
            };
            req.onerror = () => reject(req.error);
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Alle Fotos eines Projekts laden
 */
export async function getProjectPhotos(projectId) {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        return [];
    }

    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(STORE_PHOTOS, 'readonly');
            const index = tx.objectStore(STORE_PHOTOS).index('projectId');
            const req = index.getAll(projectId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Foto löschen (erst wenn vollständig verifiziert auf Supabase und OneDrive)
 */
export async function deleteOldSyncedPhotos(olderThanDays = 30) {
    if (import.meta.env.VITE_CLOUD_FIRST_IMAGES === 'true' || import.meta.env.VITE_CLOUD_FIRST_IMAGES === true) {
        console.log(`[PhotoStorage] deleteOldSyncedPhotos bypassed due to VITE_CLOUD_FIRST_IMAGES rollout protection`);
        return 0;
    }

    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        console.warn(`[PhotoStorage] Object Store "${STORE_PHOTOS}" fehlt. Cleanup übersprungen.`);
        return 0;
    }

    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(STORE_PHOTOS, 'readwrite');
            const store = tx.objectStore(STORE_PHOTOS);
            const index = store.index('createdAt');
            const req = index.openCursor(IDBKeyRange.upperBound(cutoff));
            let count = 0;

            req.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const entry = cursor.value;
                    // Nur löschen wenn remote_verified (oder legacy synced + oneDriveItemId)
                    const isFullySynced = entry.syncStatus === 'remote_verified' || 
                                         (entry.syncStatus === 'synced' && entry.oneDriveItemId);
                    if (isFullySynced) {
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
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Anzahl pending (nicht vollständig hochgeladener) Fotos
 */
export async function getPendingCount() {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        return 0;
    }

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_PHOTOS, 'readonly');
            const store = tx.objectStore(STORE_PHOTOS);
            const req = store.getAll();
            req.onsuccess = () => {
                const pending = (req.result || []).filter(p => 
                    p.syncStatus !== 'remote_verified' && p.syncStatus !== 'synced'
                );
                resolve(pending.length);
            };
            req.onerror = () => resolve(0);
        } catch (e) {
            resolve(0);
        }
    });
}
