/**
 * supabaseSyncWorker.js
 * Cloud-first Image Sync Worker
 */

import { supabase } from '../../supabaseClient.js';
import { updatePhotoSyncStatus, openDB } from '../../services/PhotoStorage.js';
import { queueImageCompression } from '../../utils/imageCompressor.js';

const SYNC_FLAG = 'qtool_sync_running';

/**
 * Run background sync for all local photos
 */
export async function syncPendingToSupabase() {
    if (sessionStorage.getItem(SYNC_FLAG) === '1') return { synced: 0, failed: 0 };
    sessionStorage.setItem(SYNC_FLAG, '1');

    let synced = 0;
    let failed = 0;

    try {
        const photos = await getPendingPhotosFromDb();
        if (!photos.length) return { synced: 0, failed: 0 };

        console.info(`[SyncWorker] 🔄 Found ${photos.length} pending photos to process.`);

        for (const photo of photos) {
            try {
                await syncOnePhoto(photo);
                synced++;
            } catch (err) {
                failed++;
                console.error('[SyncWorker] ❌ Failed to sync photo:', photo.id, err.message);
                await updatePhotoSyncStatus(photo.id, { 
                    syncStatus: 'error',
                    errorMessage: err.message 
                }).catch(() => {});
            }
        }
    } finally {
        sessionStorage.removeItem(SYNC_FLAG);
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
            // Get everything not fully remote_verified
            resolve(all.filter(p => p.syncStatus !== 'remote_verified' && p.syncStatus !== 'synced'));
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
    const ext = photo.name?.split('.').pop().toLowerCase() || 'jpg';
    const storagePath = `${testRunId}/${projectId}/Fotos/TEST__${photo.id}.${ext}`;
    
    // 1. Compression Phase (local_only -> queued_for_sync)
    if (photo.syncStatus === 'local_only' || !photo.compressed) {
        console.log(`[SyncWorker] ⚙️ Compressing photo ${photo.id}...`);
        const result = await queueImageCompression(photo.blob, photo.meta?.isSketch);
        
        // Save compressed blobs back to IndexedDB
        photo.compressed = result.compressed;
        photo.pdf = result.pdf;
        photo.preview = result.preview;
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

    const compressedBlob = photo.compressed.blob;
    if (!compressedBlob) throw new Error('Compressed Blob is missing');

    // 2. Storage Upload (queued_for_sync -> uploaded_to_backend)
    if (photo.syncStatus === 'queued_for_sync') {
        console.log(`[SyncWorker] ☁️ Uploading photo ${photo.id} to Supabase storage...`);
        
        const { error: uploadErr } = await supabase.storage
            .from('case-files')
            .upload(storagePath, compressedBlob, {
                contentType: photo.compressed.mimeType || 'image/jpeg',
                upsert: true
            });

        if (uploadErr) {
            throw new Error(`Supabase Storage upload failed: ${uploadErr.message}`);
        }

        // 3. Verify upload integrity in Cloud
        const parentPath = `${testRunId}/${projectId}/Fotos`;
        const { data: fileList, error: listErr } = await supabase.storage
            .from('case-files')
            .list(parentPath, { search: `TEST__${photo.id}` });

        if (listErr || !fileList || !fileList.length) {
            throw new Error(`Storage upload verification failed: File not found in bucket listing. (${listErr?.message || 'Empty list'})`);
        }

        const uploadedFile = fileList[0];
        if (uploadedFile.metadata?.size === 0 || uploadedFile.size === 0) {
            throw new Error('Storage verification failed: Uploaded file is empty (0 bytes).');
        }

        console.log(`[SyncWorker] ✅ Storage verified: ${storagePath} (${uploadedFile.size} bytes)`);

        // 4. Update project_image_uploads journal table in database
        const { error: journalErr } = await supabase
            .from('project_image_uploads')
            .upsert({
                local_image_id: photo.id,
                project_id: projectId,
                filename: photo.name,
                mime_type: photo.compressed.mimeType,
                size_bytes: photo.compressed.size,
                sha256: photo.compressed.sha256,
                storage_bucket: 'case-files',
                storage_path: storagePath,
                storage_status: 'uploaded_to_backend',
                updated_at: new Date().toISOString()
            }, { onConflict: 'local_image_id' });

        if (journalErr) {
            throw new Error(`Database journal upsert failed: ${journalErr.message}`);
        }

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
            throw new Error(`Project fetch failed during commit: ${fetchErr?.message || 'Row not found'}`);
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
                fileType: ext,
                size: photo.compressed.size,
                sha256: photo.compressed.sha256
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
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onedrive-upload-worker`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        }).catch(() => {});

        // Since the backend Edge function runs asynchronously, we check the project_image_uploads status in Supabase DB 
        // to verify when it gets marked as remote_verified or uploaded.
        // Let's poll or wait momentarily. If not complete, it will be picked up on the next sync run or boot.
        let checkAttempts = 0;
        const maxChecks = 5;
        while (checkAttempts < maxChecks) {
            await new Promise(r => setTimeout(r, 1000));
            const { data: journalRow, error: checkErr } = await supabase
                .from('project_image_uploads')
                .select('storage_status, remote_path, remote_item_id')
                .eq('local_image_id', photo.id)
                .single();

            if (!checkErr && journalRow) {
                if (journalRow.storage_status === 'remote_verified' || journalRow.remote_item_id) {
                    console.log(`[SyncWorker] ☁️ OneDrive Verified for photo ${photo.id}!`);
                    await updatePhotoSyncStatus(photo.id, {
                        syncStatus: 'remote_verified',
                        oneDriveItemId: journalRow.remote_item_id,
                        oneDrivePath: journalRow.remote_path
                    });
                    break;
                }
            }
            checkAttempts++;
        }
    }
}
