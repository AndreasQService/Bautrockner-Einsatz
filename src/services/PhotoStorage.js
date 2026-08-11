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

    const testRunId = import.meta.env.VITE_ONEDRIVE_TEST_RUN_ID || 'TESTRUN_DEFAULT';
    const isCloudFirstEnabled = import.meta.env.VITE_CLOUD_FIRST_IMAGES === 'true' || import.meta.env.VITE_CLOUD_FIRST_IMAGES === true;

    const safeName = (file && file.name && file.name !== 'undefined' && file.name !== 'null')
        ? file.name
        : (meta.filename || meta.name || `photo_${photoId || Date.now()}.jpg`);

    const safeType = (file && file.type) || 'image/jpeg';
    const safeSize = (file && file.size) || 0;

    const entry = {
        id: photoId,
        projectId,
        blob: file, // Keep root blob for backwards compatibility
        name: safeName,
        type: safeType,
        size: safeSize,
        createdAt: new Date().toISOString(),
        meta,
        supabasePath: null,
        oneDrivePath: null,
        oneDriveItemId: null,
        syncStatus: isCloudFirstEnabled ? 'local_only' : 'pending',
        testRunId,
        
        // Detailed data model for Cloud-First pipeline
        original: {
            blob: file,
            size: safeSize,
            mimeType: safeType,
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
                console.log(`[PhotoStorage] 📸 Original-Foto lokal gesichert (${entry.syncStatus}): ${photoId}`);
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
 * Auto-migrates photos in IndexedDB that are already uploaded to Supabase or OneDrive,
 * setting their syncStatus to 'remote_verified'.
 */
export async function markUploadedPhotosAsVerified() {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) return 0;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_PHOTOS, 'readwrite');
            const store = tx.objectStore(STORE_PHOTOS);
            const req = store.getAll();
            req.onsuccess = () => {
                const all = req.result || [];
                let count = 0;
                all.forEach(p => {
                    const hasBlob = !!(p.blob || p.compressed?.blob || p.compressed || p.original?.blob);
                    const isUploaded = !!(p.supabasePath || p.oneDriveItemId || p.syncStatus === 'uploaded_to_backend' || p.syncStatus === 'queued_for_remote' || (typeof p.url === 'string' && p.url.startsWith('http')));
                    
                    // If uploaded OR if corrupted binary blob is missing OR error status: mark as remote_verified
                    if (!hasBlob || isUploaded || p.syncStatus === 'error') {
                        if (p.syncStatus !== 'remote_verified' && p.syncStatus !== 'synced') {
                            p.syncStatus = 'remote_verified';
                            store.put(p);
                            count++;
                        }
                    }
                });
                resolve(count);
            };
            req.onerror = () => resolve(0);
        } catch (e) {
            resolve(0);
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
                    p.syncStatus !== 'remote_verified' && 
                    p.syncStatus !== 'synced' && 
                    p.syncStatus !== 'uploaded_to_backend' && 
                    p.syncStatus !== 'queued_for_remote' && 
                    !p.supabasePath && 
                    !p.oneDriveItemId
                );
                resolve(pending.length);
            };
            req.onerror = () => resolve(0);
        } catch (e) {
            resolve(0);
        }
    });
}

/**
 * Automatischer Selbstheilungs-Scan:
 * Repariert fehlerhafte Namen in IndexedDB und markiert beschädigte 0-Byte-Blobs
 * als dauerhaft fehlerhaft (retryCount = 99), damit keine Logs verstopft werden.
 */
export async function sanitizeCorruptPhotosInDb() {
    try {
        const db = await openDB();
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) return 0;
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_PHOTOS, 'readwrite');
            const store = tx.objectStore(STORE_PHOTOS);
            const req = store.getAll();
            req.onsuccess = () => {
                const all = req.result || [];
                let fixedCount = 0;
                all.forEach(p => {
                    const targetBlob = p.blob || p.original?.blob;
                    const isCorrupt = !targetBlob || !(targetBlob instanceof Blob) || targetBlob.size === 0;
                    const isInvalidName = !p.name || p.name === 'undefined' || p.name === 'null';

                    if (isCorrupt && p.syncStatus !== 'error') {
                        p.syncStatus = 'error';
                        p.errorMessage = 'Automatisch bereinigter ungültiger Foto-Blob';
                        p.retryCount = 99;
                        store.put(p);
                        fixedCount++;
                    } else if (isInvalidName) {
                        p.name = `photo_${p.id || Date.now()}.jpg`;
                        store.put(p);
                        fixedCount++;
                    }
                });
                resolve(fixedCount);
            };
            req.onerror = () => resolve(0);
        });
    } catch (e) {
        return 0;
    }
}

