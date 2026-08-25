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
let _dbOpening = null;

function invalidateDb(db) {
    if (!db || _db === db) {
        _db = null;
    }
}

function isClosingConnectionError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return error?.name === 'InvalidStateError' ||
        message.includes('connection is closing') ||
        message.includes('database connection is closing') ||
        message.includes('closing connection');
}

/**
 * IndexedDB öffnen / initialisieren
 */
export async function openDB() {
    if (_db) return _db;
    if (_dbOpening) return _dbOpening;

    _dbOpening = new Promise((resolve, reject) => {
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
            const db = req.result;
            db.onversionchange = () => {
                db.close();
                invalidateDb(db);
            };
            db.onclose = () => invalidateDb(db);
            _db = db;
            resolve(db);
        };
        req.onerror = () => reject(req.error);
    });

    try {
        return await _dbOpening;
    } finally {
        _dbOpening = null;
    }
}

async function openPhotoWriteTransaction() {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const db = await openDB();
        try {
            return db.transaction(STORE_PHOTOS, 'readwrite');
        } catch (error) {
            if (!isClosingConnectionError(error) || attempt === 1) throw error;
            invalidateDb(db);
            try { db.close(); } catch (_) {}
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    throw new Error('IndexedDB konnte nicht erneut geöffnet werden.');
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

    return new Promise(async (resolve, reject) => {
        try {
            const tx = await openPhotoWriteTransaction();
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
            };
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Foto-Syncstatus konnte nicht dauerhaft gespeichert werden.'));
        } catch (e) {
            reject(e);
        }
    });
}

/** Remove one photo from the durable offline store. */
export async function deletePhotoLocally(photoId) {
    if (!photoId) return false;
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) return false;

    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(STORE_PHOTOS, 'readwrite');
            tx.objectStore(STORE_PHOTOS).delete(photoId);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Foto konnte lokal nicht gelöscht werden.'));
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Recover photos that were queued with the temporary project key after a stale
 * local draft replaced the real report id. Only explicitly named photo ids are
 * moved, so photos from another draft cannot be attached to the open project.
 */
export async function reassignTemporaryPhotos(photoIds, projectId) {
    const ids = new Set((photoIds || []).filter(Boolean));
    if (!projectId || ids.size === 0) return 0;

    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) return 0;

    return new Promise((resolve, reject) => {
        let recovered = 0;
        const tx = db.transaction(STORE_PHOTOS, 'readwrite');
        const store = tx.objectStore(STORE_PHOTOS);
        const req = store.getAll();

        req.onsuccess = () => {
            for (const photo of req.result || []) {
                if (photo.projectId !== 'temp' || !ids.has(photo.id)) continue;
                store.put({
                    ...photo,
                    projectId,
                    syncStatus: photo.supabasePath ? 'uploaded_to_backend' : 'local_only',
                    retryCount: 0,
                    errorMessage: null
                });
                recovered += 1;
            }
        };
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => resolve(recovered);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Foto-Zuordnung wurde abgebrochen.'));
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
                    p.syncStatus !== 'remote_verified' &&
                    p.syncStatus !== 'synced' &&
                    p.syncStatus !== 'terminal_error' &&
                    p.terminalFailure !== true
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
                    // Lokale Originale erst löschen, wenn beide Provider und die
                    // Projektverknüpfung explizit bestätigt wurden. Alte/abgeleitete
                    // Statuswerte sind kein belastbarer Nachweis.
                    const isFullySynced = entry.syncStatus === 'remote_verified' &&
                        !!entry.supabaseVerifiedAt &&
                        !!entry.projectLinkedAt &&
                        !!entry.oneDriveVerifiedAt &&
                        !!entry.oneDriveItemId;
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
    console.warn('[PhotoStorage] Automatische Verifikation deaktiviert: Provider-Nachweise sind erforderlich.');
    return 0;
}

/**
 * Anzahl pending (nicht vollständig hochgeladener) Fotos
 */
export async function getPendingCount(projectId = null) {
    if (projectId) {
        const pending = await getPendingPhotos(projectId);
        return pending.length;
    }
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
                    p.syncStatus !== 'terminal_error' &&
                    p.terminalFailure !== true
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

                    if (isCorrupt && p.syncStatus !== 'terminal_error') {
                        p.syncStatus = 'terminal_error';
                        p.errorMessage = 'Automatisch bereinigter ungültiger Foto-Blob';
                        p.terminalFailure = true;
                        p.needsUserAction = true;
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

