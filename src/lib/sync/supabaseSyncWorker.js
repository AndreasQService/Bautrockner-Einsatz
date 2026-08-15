/**
 * supabaseSyncWorker.js
 * Cloud-first Image Sync Worker for Production QTool
 */

import { supabase } from '../../supabaseClient.js';
import { updatePhotoSyncStatus, openDB } from '../../services/PhotoStorage.js';
import { queueImageCompression } from '../../utils/imageCompressor.js';

let isSyncRunning = false;

/**
 * Run background sync for all local photos
 */
export async function syncPendingToSupabase({ allowLegacyMigration = false } = {}) {
    // P0 fail-closed: this pre-offline-first worker owns a second IndexedDB and
    // performs a read/modify/write of damage_reports.report_data. Running it in
    // normal runtime can overwrite a newer central snapshot with stale image
    // metadata. Legacy rows stay durable and visible for an explicit migration;
    // they are never uploaded or marked synced implicitly.
    if (allowLegacyMigration !== true) {
        return { synced: 0, failed: 0, skipped: 'legacy_migration_not_explicit' };
    }
    if (isSyncRunning) return { synced: 0, failed: 0 };
    if (!supabase) return { synced: 0, failed: 0 };

    // Check if user is authenticated with Supabase before attempting Cloud Sync
    const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: {} }));
    if (!session) {
        // Unauthenticated: Keep data safely in local IndexedDB without spamming HTTP 401
        return { synced: 0, failed: 0 };
    }

    isSyncRunning = true;

    let synced = 0;
    let failed = 0;

    try {
        const photos = await getPendingPhotosFromDb();
        if (!photos.length) {
            isSyncRunning = false;
            return { synced: 0, failed: 0 };
        }

        console.info(`[SyncWorker] 🔄 Found ${photos.length} pending photos to process.`);

        for (const photo of photos) {
            try {
                await syncOnePhoto(photo);
                synced++;
            } catch (err) {
                failed++;
                let errMsg = 'Unknown sync error';
                if (err instanceof Error) {
                    errMsg = err.message || err.name || 'Error without message';
                } else if (typeof err === 'string') {
                    errMsg = err;
                } else if (err && typeof err === 'object') {
                    if (err.message) {
                        errMsg = String(err.message);
                    } else if (err.error_description) {
                        errMsg = String(err.error_description);
                    } else if (err.type) {
                        errMsg = `DOM Event Error (${err.type})`;
                    } else {
                        try {
                            const str = JSON.stringify(err);
                            errMsg = (str && str !== '{}') ? str : String(err);
                        } catch {
                            errMsg = String(err);
                        }
                    }
                }
                if (!errMsg || errMsg === 'undefined' || errMsg === '[object Object]') {
                    errMsg = 'Corrupt or un-decodable photo data in local storage';
                }

                const isCorruptOrInvalid = errMsg.includes('Canvas') || errMsg.includes('Invalid') || errMsg.includes('corrupt') || errMsg.includes('DOM Event');
                const finalRetryCount = isCorruptOrInvalid ? 99 : (photo.retryCount || 0) + 1;

                console.warn('[SyncWorker] ⚠️ Bypassing photo sync issue:', photo.id, errMsg);
                await updatePhotoSyncStatus(photo.id, { 
                    syncStatus: 'error',
                    errorMessage: errMsg,
                    retryCount: finalRetryCount
                }).catch(() => {});
            }
        }
    } catch (globalErr) {
        console.error('[SyncWorker] 💥 Global sync error:', globalErr);
    } finally {
        isSyncRunning = false;
    }

    return { synced, failed };
}

/**
 * Get all pending photos from IndexedDB
 */
async function getPendingPhotosFromDb() {
    const db = await openDB();
    if (!db.objectStoreNames.contains('photos')) return [];
    
    return new Promise((resolve, reject) => {
        const tx = db.transaction('photos', 'readonly');
        const req = tx.objectStore('photos').getAll();
        req.onsuccess = () => {
            const all = req.result || [];
            // Get everything not fully uploaded/remote_verified, and not failed 3+ times (avoids blocking queue/CPU lock)
            resolve(all.filter(p => 
                p.syncStatus !== 'remote_verified' && 
                p.syncStatus !== 'synced' && 
                p.syncStatus !== 'uploaded_to_backend' && 
                p.syncStatus !== 'queued_for_remote' && 
                !p.supabasePath && 
                !p.oneDriveItemId &&
                (p.retryCount || 0) < 3
            ));
        };
        req.onerror = () => reject(req.error);
    });
}

/**
 * Process and sync a single photo
 */
async function syncOnePhoto(photo) {
    if (!supabase) throw new Error('Supabase Client not available');
    
    const projectId = photo.projectId || 'TEST__ISOLATION_001';
    const testRunId = photo.testRunId || import.meta.env.VITE_ONEDRIVE_TEST_RUN_ID || 'TESTRUN_DEFAULT';
    
    let safeName = photo.name;
    if (!safeName || safeName === 'undefined' || safeName === 'null') {
        safeName = `photo_${photo.id || Date.now()}.jpg`;
    }
    const ext = safeName.split('.').pop().toLowerCase() || 'jpg';
    const storagePath = `${testRunId}/${projectId}/Fotos/TEST__${photo.id}.${ext}`;
    
    // 1. Compression Phase
    if (!photo.compressed || !photo.compressed.blob) {
        console.log(`[SyncWorker] ⚙️ Compressing photo ${photo.id}...`);
        const targetBlob = photo.blob || photo.original?.blob;
        if (!targetBlob || !(targetBlob instanceof Blob) || targetBlob.size === 0) {
            console.warn(`[SyncWorker] ⚠️ Bypassing invalid/corrupt photo blob for ${photo.id}`);
            await updatePhotoSyncStatus(photo.id, { 
                syncStatus: 'error',
                errorMessage: 'Invalid or empty photo blob in local storage',
                retryCount: 99
            }).catch(() => {});
            return;
        }
        let fileToCompress = targetBlob;
        if (!(targetBlob instanceof File)) {
            try {
                fileToCompress = new File([targetBlob], safeName, { type: targetBlob.type || 'image/jpeg' });
            } catch {
                fileToCompress = targetBlob;
                try {
                    if (!fileToCompress.name || fileToCompress.name === 'undefined') {
                        Object.defineProperty(fileToCompress, 'name', { value: safeName, writable: true, configurable: true });
                    }
                } catch {
                    // Some Blob implementations do not allow a synthetic name.
                }
            }
        }
        const result = await queueImageCompression(fileToCompress, photo.meta?.isSketch);
        
        photo.compressed = result.compressed;
        photo.pdf = result.pdf;
        photo.preview = result.preview;
        photo.original = photo.original || {};
        photo.original.sha256 = result.original.sha256;
        photo.syncStatus = 'queued_for_sync';
        
        await updatePhotoSyncStatus(photo.id, {
            original: photo.original,
            compressed: photo.compressed,
            pdf: photo.pdf,
            preview: photo.preview,
            syncStatus: 'queued_for_sync'
        });
    }

    const compressedBlob = photo.compressed?.blob || photo.compressed || photo.blob || photo.original?.blob;
    if (!compressedBlob) throw new Error('Compressed Blob is missing');

    const sha256 = photo.compressed?.sha256 || photo.original?.sha256 || 'SHA_FALLBACK';

    // 2. Storage Upload (run for any photo not yet uploaded)
    if (photo.syncStatus !== 'uploaded_to_backend' && photo.syncStatus !== 'remote_verified' && photo.syncStatus !== 'synced') {
        console.log(`[SyncWorker] ☁️ Uploading photo ${photo.id} to Supabase storage...`);
        
        const { error: uploadErr } = await supabase.storage
            .from('case-files')
             .upload(storagePath, compressedBlob, {
                contentType: photo.compressed?.mimeType || photo.type || 'image/jpeg',
                upsert: true
            });

        if (uploadErr) {
            throw new Error(`Supabase Storage upload failed: ${uploadErr.message}`);
        }

        console.log(`[SyncWorker] ✅ Storage upload successful: ${storagePath}`);

        // Note: project_image_uploads journal table is managed directly by backend edge functions and triggers.

        await updatePhotoSyncStatus(photo.id, {
            syncStatus: 'uploaded_to_backend',
            supabasePath: storagePath
        });
        photo.syncStatus = 'uploaded_to_backend';
    }

    // 5. Atomarer Project-Commit (write reference to damage_reports table)
    if (photo.syncStatus === 'uploaded_to_backend') {
        console.log(`[SyncWorker] 🔗 Linking photo ${photo.id} to project damage report...`);

        const { data: projectRow, error: fetchErr } = await supabase
            .from('damage_reports')
            .select('report_data')
            .eq('id', projectId)
            .single();

        if (fetchErr || !projectRow) {
            console.log(`[SyncWorker] ℹ️ Project row ${projectId} not in DB yet. Photo ${photo.id} uploaded to storage successfully.`);
            await updatePhotoSyncStatus(photo.id, {
                syncStatus: 'uploaded_to_backend',
                supabasePath: storagePath
            });
            photo.syncStatus = 'uploaded_to_backend';
            return;
        }

        const reportData = projectRow.report_data || {};
        if (!reportData.images) reportData.images = [];

        // Check if already linked
        const isLinked = reportData.images.some(img => img.id === photo.id);
        if (!isLinked) {
            reportData.images.push({
                id: photo.id,
                name: photo.name,
                date: photo.createdAt || new Date().toISOString(),
                preview: null, // loaded dynamically from IndexedDB
                storagePath: storagePath,
                supabaseBackedUpAt: new Date().toISOString(),
                uploading: false,
                error: false,
                type: 'image',
                size: photo.compressed?.size || compressedBlob.size || photo.size || 0,
                fileType: ext,
                sha256: sha256,
                assignedTo: photo.meta?.assignedTo || 'Sonstiges',
                includeInReport: photo.meta?.includeInReport !== undefined ? photo.meta.includeInReport : true
            });

            const { error: updateErr } = await supabase
                .from('damage_reports')
                .update({ report_data: reportData })
                .eq('id', projectId);

            if (updateErr) {
                throw new Error(`Project report_data update failed: ${updateErr.message}`);
            }
            console.log(`[SyncWorker] 🔗 Photo ${photo.id} successfully linked to project.`);
        }

        // 6. Complete and wait for OneDrive Sync (queued_for_remote -> remote_verified)
        // Since OneDrive is handled by the backend function, we trigger the Edge function trigger
        await updatePhotoSyncStatus(photo.id, {
            syncStatus: 'queued_for_remote'
        });
        photo.syncStatus = 'queued_for_remote';

        // Trigger Edge function upload
        const { error: invokeError } = await supabase.functions.invoke('onedrive-upload-worker', { body: {} });
        if (invokeError) throw invokeError;

        // Since the backend Edge function runs asynchronously, we check the project_image_uploads status in Supabase DB 
        // to verify when it gets marked as remote_verified or uploaded.
        // Let's poll or wait momentarily. If not complete, it will be picked up on the next sync run or boot.
        let checkAttempts = 0;
        const maxChecks = 5;
        while (checkAttempts < maxChecks) {
            await new Promise(r => setTimeout(r, 1000));
            const { data: journalRow, error: checkErr } = await supabase
                .from('project_image_uploads')
                .select('project_id,storage_status,remote_path,remote_drive_id,remote_item_id,remote_etag,remote_size_bytes,remote_sha256,verified_at')
                .eq('local_image_id', photo.id)
                .single();

            if (!checkErr && journalRow) {
                const exactProof = journalRow.storage_status === 'remote_verified'
                    && String(journalRow.project_id || '') === String(projectId)
                    && journalRow.remote_drive_id
                    && journalRow.remote_item_id
                    && journalRow.remote_etag
                    && journalRow.verified_at
                    && Number(journalRow.remote_size_bytes) === Number(compressedBlob.size)
                    && String(journalRow.remote_sha256 || '').toLowerCase() === String(sha256 || '').toLowerCase();
                if (exactProof) {
                    console.log(`[SyncWorker] ☁️ OneDrive Verified for photo ${photo.id}!`);
                    await updatePhotoSyncStatus(photo.id, {
                        syncStatus: 'remote_verified',
                        oneDriveItemId: journalRow.remote_item_id,
                        oneDrivePath: journalRow.remote_path,
                        oneDriveDriveId: journalRow.remote_drive_id,
                        oneDriveETag: journalRow.remote_etag,
                        oneDriveSha256: journalRow.remote_sha256,
                        oneDriveVerifiedAt: journalRow.verified_at
                    });
                    return;
                }
            }
            checkAttempts++;
        }
        // Never manufacture a success state. The durable legacy row remains
        // queued and is retried only by an explicit migration run.
        throw Object.assign(new Error('OneDrive-Endbestätigung mit exaktem Drive-/SHA-Nachweis steht noch aus'), { retryable: true });
    }
}
