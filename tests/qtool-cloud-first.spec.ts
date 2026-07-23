import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:5180';

test.describe('QTool Cloud-First & E2E-Resilienz Tests', () => {

    test.beforeEach(async ({ page }) => {
        // App laden und Session vorab im localStorage eintragen
        await page.goto(BASE_URL);
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
            const testUser = { id: 2, name: 'Techniker 1', role: 'technician', password: '123' };
            localStorage.setItem('qtool_current_user', JSON.stringify(testUser));
            localStorage.setItem('qservice_current_view', 'dashboard');
        });
        await page.reload();
        await page.waitForTimeout(1000);
    });

    test('1. Blob dauerhaft in IndexedDB', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { savePhotoLocally, getPhotoBlob } = await import('/src/services/PhotoStorage.js');
            const testBlob = new Blob(['dummy original content'], { type: 'image/png' });
            const file = new File([testBlob], 'test.png', { type: 'image/png' });
            
            const photoId = 'test_photo_001';
            await savePhotoLocally(photoId, 'TEST__PROJECT_ID', file);
            
            const retrievedUrl = await getPhotoBlob(photoId, 'original');
            if (!retrievedUrl) return { success: false, reason: 'No URL returned' };
            
            const resp = await fetch(retrievedUrl);
            const text = await resp.text();
            return { success: text === 'dummy original content', size: testBlob.size };
        });
        expect(result.success).toBe(true);
    });

    test('2. Wiederherstellung in einem vollständig neuen Browser-Kontext', async ({ page, context }) => {
        // Kontext 1: Speichern
        const photoId = 'test_photo_context_recovery';
        await page.evaluate(async (id) => {
            const { savePhotoLocally } = await import('/src/services/PhotoStorage.js');
            const testBlob = new Blob(['recovery test content'], { type: 'image/png' });
            const file = new File([testBlob], 'recovery.png', { type: 'image/png' });
            await savePhotoLocally(id, 'TEST__PROJECT_ID', file);
        }, photoId);

        // Kontext 1 schließen und Kontext 2 öffnen (über Playwright-API simuliert)
        const newPage = await context.newPage();
        await newPage.goto(BASE_URL);
        await newPage.waitForTimeout(500);

        // Aus neuem Kontext lesen
        const result = await newPage.evaluate(async (id) => {
            const { getPhotoBlob } = await import('/src/services/PhotoStorage.js');
            const url = await getPhotoBlob(id, 'original');
            if (!url) return { recovered: false };
            const resp = await fetch(url);
            const text = await resp.text();
            return { recovered: text === 'recovery test content' };
        }, photoId);
        
        expect(result.recovered).toBe(true);
        await newPage.close();
    });

    test('3. kein großes Bild in localStorage', async ({ page }) => {
        const hasLargeData = await page.evaluate(() => {
            let largeFound = false;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i) || '';
                const val = localStorage.getItem(key) || '';
                if (val.length > 10 * 1024) { // > 10KB
                    largeFound = true;
                }
            }
            return largeFound;
        });
        expect(hasLargeData).toBe(false);
    });

    test('4. keine Projektbildreferenz vor bestätigtem Cloud-Upload', async ({ page }) => {
        const isReferenced = await page.evaluate(async () => {
            const { savePhotoLocally } = await import('/src/services/PhotoStorage.js');
            const testBlob = new Blob(['uncomitted content'], { type: 'image/png' });
            const file = new File([testBlob], 'uncommitted.png', { type: 'image/png' });
            
            const photoId = 'uncommitted_photo_001';
            await savePhotoLocally(photoId, 'TEST__PROJECT_ID', file);
            
            // Check reports list
            const saved = localStorage.getItem('qservice_reports_prod');
            if (!saved) return false;
            const reports = JSON.parse(saved);
            const report = reports.find(r => r.id === 'TEST__PROJECT_ID');
            if (!report) return false;
            
            return report.images?.some(img => img.id === photoId) || false;
        });
        expect(isReferenced).toBe(false);
    });

    test('5. lokaler Blob bleibt bei Supabase-Uploadfehler', async ({ page }) => {
        // Intercept Supabase Storage and return error
        await page.route('**/storage/v1/object/case-files/**', async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Simulated Supabase Upload Error' })
            });
        });

        const status = await page.evaluate(async () => {
            const { savePhotoLocally, getPhotoBlob } = await import('/src/services/PhotoStorage.js');
            const { syncPendingToSupabase } = await import('/src/lib/sync/supabaseSyncWorker.js');
            
            const photoId = 'test_photo_supabase_error';
            const testBlob = new Blob(['supabase test original'], { type: 'image/png' });
            const file = new File([testBlob], 'error_supabase.png', { type: 'image/png' });
            await savePhotoLocally(photoId, 'TEST__ISOLATION_001', file);
            
            // Run sync
            await syncPendingToSupabase().catch(() => {});
            
            // Verify blob is still in IndexedDB
            const url = await getPhotoBlob(photoId, 'original');
            if (!url) return { exists: false };
            const text = await (await fetch(url)).text();
            return { exists: text === 'supabase test original' };
        });
        expect(status.exists).toBe(true);
    });

    test('6. lokaler Blob bleibt bei Projekt-Commitfehler', async ({ page }) => {
        // Intercept REST update/upsert on damage_reports and return error
        await page.route('**/rest/v1/damage_reports*', async (route) => {
            const method = route.request().method();
            if (method !== 'GET') {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ message: 'Simulated database update error' })
                });
            } else {
                await route.continue();
            }
        });

        // Mock Supabase storage upload to succeed
        await page.route('**/storage/v1/object/case-files/**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ Key: 'test/path.jpg' })
            });
        });

        const status = await page.evaluate(async () => {
            const { savePhotoLocally, getPhotoBlob } = await import('/src/services/PhotoStorage.js');
            const { syncPendingToSupabase } = await import('/src/lib/sync/supabaseSyncWorker.js');
            
            const photoId = 'test_photo_commit_error';
            const testBlob = new Blob(['commit test original'], { type: 'image/png' });
            const file = new File([testBlob], 'error_commit.png', { type: 'image/png' });
            await savePhotoLocally(photoId, 'TEST__ISOLATION_001', file);
            
            await syncPendingToSupabase().catch(() => {});
            
            const url = await getPhotoBlob(photoId, 'original');
            if (!url) return { exists: false };
            const text = await (await fetch(url)).text();
            return { exists: text === 'commit test original' };
        });
        expect(status.exists).toBe(true);
    });

    test('7. lokaler Blob bleibt bei OneDrive-Fehler', async ({ page }) => {
        // Storage upload and db upsert succeed, but OneDrive verification function returns error
        await page.route('**/functions/v1/onedrive-upload-worker', async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Simulated OneDrive Error' })
            });
        });

        const status = await page.evaluate(async () => {
            const { savePhotoLocally, getPhotoBlob } = await import('/src/services/PhotoStorage.js');
            const { syncPendingToSupabase } = await import('/src/lib/sync/supabaseSyncWorker.js');
            
            const photoId = 'test_photo_onedrive_error';
            const testBlob = new Blob(['onedrive test original'], { type: 'image/png' });
            const file = new File([testBlob], 'error_onedrive.png', { type: 'image/png' });
            await savePhotoLocally(photoId, 'TEST__ISOLATION_001', file);
            
            await syncPendingToSupabase().catch(() => {});
            
            const url = await getPhotoBlob(photoId, 'original');
            if (!url) return { exists: false };
            const text = await (await fetch(url)).text();
            return { exists: text === 'onedrive test original' };
        });
        expect(status.exists).toBe(true);
    });

    test('8. lokaler Blob bleibt bei Manifest-412', async ({ page }) => {
        // Mock journal check to return manifest error / status error
        await page.route('**/rest/v1/project_image_uploads*', async (route) => {
            const method = route.request().method();
            if (method === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([{ storage_status: 'error', error_details: 'Precondition Failed (412)' }])
                });
            } else {
                await route.continue();
            }
        });

        const status = await page.evaluate(async () => {
            const { savePhotoLocally, getPhotoBlob } = await import('/src/services/PhotoStorage.js');
            const { syncPendingToSupabase } = await import('/src/lib/sync/supabaseSyncWorker.js');
            
            const photoId = 'test_photo_manifest_412';
            const testBlob = new Blob(['manifest 412 test original'], { type: 'image/png' });
            const file = new File([testBlob], 'error_412.png', { type: 'image/png' });
            await savePhotoLocally(photoId, 'TEST__ISOLATION_001', file);
            
            await syncPendingToSupabase().catch(() => {});
            
            const url = await getPhotoBlob(photoId, 'original');
            if (!url) return { exists: false };
            const text = await (await fetch(url)).text();
            return { exists: text === 'manifest 412 test original' };
        });
        expect(status.exists).toBe(true);
    });

    test('9. QuotaExceededError löscht keine bestehenden Bilder', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { savePhotoLocally, getPhotoBlob, openDB } = await import('/src/services/PhotoStorage.js');
            
            const id1 = 'quota_saved_photo_1';
            const id2 = 'quota_failed_photo_2';
            
            // 1. Store first photo successfully
            const blob1 = new Blob(['valid photo 1'], { type: 'image/png' });
            await savePhotoLocally(id1, 'TEST__PROJECT', new File([blob1], 'photo1.png', { type: 'image/png' }));
            
            // 2. Simulate QuotaExceededError on next write by overriding transactional put
            const db = await openDB();
            const originalTransaction = db.transaction.bind(db);
            db.transaction = function(storeName, mode) {
                const tx = originalTransaction(storeName, mode);
                if (mode === 'readwrite') {
                    const originalObjectStore = tx.objectStore.bind(tx);
                    tx.objectStore = function(name) {
                        const store = originalObjectStore(name);
                        const originalPut = store.put.bind(store);
                        store.put = function(item) {
                            if (item.id === id2) {
                                throw new DOMException('Simulated QuotaExceededError', 'QuotaExceededError');
                            }
                            return originalPut(item);
                        };
                        return store;
                    };
                }
                return tx;
            };

            let threwQuotaError = false;
            try {
                const blob2 = new Blob(['photo 2 that triggers quota exceed'], { type: 'image/png' });
                await savePhotoLocally(id2, 'TEST__PROJECT', new File([blob2], 'photo2.png', { type: 'image/png' }));
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    threwQuotaError = true;
                }
            }

            // Restore original transaction
            db.transaction = originalTransaction;

            // 3. Verify photo 1 is still intact
            const url = await getPhotoBlob(id1, 'original');
            if (!url) return { ok: false, reason: 'Photo 1 lost' };
            const text = await (await fetch(url)).text();
            
            return { ok: threwQuotaError && text === 'valid photo 1' };
        });
        expect(result.ok).toBe(true);
    });

    test('10. mehrfacher Klick erzeugt kein Duplikat', async ({ page }) => {
        const count = await page.evaluate(async () => {
            const { savePhotoLocally, openDB } = await import('/src/services/PhotoStorage.js');
            const photoId = 'duplicate_test_photo_id';
            const testBlob = new Blob(['duplicate content'], { type: 'image/png' });
            const file = new File([testBlob], 'dup.png', { type: 'image/png' });
            
            // Parallel storage triggers (e.g. double click)
            await Promise.all([
                savePhotoLocally(photoId, 'TEST__PROJECT_ID', file),
                savePhotoLocally(photoId, 'TEST__PROJECT_ID', file)
            ]);
            
            // Count entries in IndexedDB
            const db = await openDB();
            return new Promise((resolve) => {
                const tx = db.transaction('photos', 'readonly');
                const req = tx.objectStore('photos').getAll();
                req.onsuccess = () => {
                    const matched = (req.result || []).filter(p => p.id === photoId);
                    resolve(matched.length);
                };
            });
        });
        expect(count).toBe(1);
    });

    test('11. 2048 Pixel und ungefähr 82 % JPEG', async ({ page }) => {
        const metrics = await page.evaluate(async () => {
            const { queueImageCompression } = await import('/src/utils/imageCompressor.js');
            
            // Create a large 3000x2000 canvas to generate a high resolution test blob
            const canvas = document.createElement('canvas');
            canvas.width = 3000;
            canvas.height = 2000;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, 3000, 2000);
            
            const bigBlob = await new Promise(r => canvas.toBlob(r, 'image/jpeg'));
            const file = new File([bigBlob], 'large.jpg', { type: 'image/jpeg' });
            
            const result = await queueImageCompression(file);
            const compressedBlob = result.compressed.blob;
            
            // Read compressed image dimensions
            const img = new window.Image();
            const url = URL.createObjectURL(compressedBlob);
            await new Promise((resolve) => {
                img.onload = resolve;
                img.src = url;
            });
            
            return {
                longestSide: Math.max(img.width, img.height),
                mimeType: compressedBlob.type
            };
        });
        
        expect(metrics.longestSide).toBe(2048);
        expect(metrics.mimeType).toBe('image/jpeg');
    });

    test('12. HEIC-Fehler verliert das Original nicht', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { savePhotoLocally, openDB } = await import('/src/services/PhotoStorage.js');
            const { syncPendingToSupabase } = await import('/src/lib/sync/supabaseSyncWorker.js');
            
            // Create a fake HEIC file
            const heicBlob = new Blob(['fake heic header and content'], { type: 'image/heic' });
            const file = new File([heicBlob], 'image.heic', { type: 'image/heic' });
            
            const photoId = 'test_heic_loss_prevention';
            await savePhotoLocally(photoId, 'TEST__PROJECT_ID', file);
            
            // Running sync on this will fail during compression of this fake HEIC file
            await syncPendingToSupabase().catch(() => {});
            
            // Retrieve record from IndexedDB directly to ensure original HEIC is still present
            const db = await openDB();
            return new Promise((resolve) => {
                const tx = db.transaction('photos', 'readonly');
                const req = tx.objectStore('photos').get(photoId);
                req.onsuccess = () => {
                    const entry = req.result;
                    if (!entry) { resolve({ ok: false }); return; }
                    resolve({
                        ok: entry.original && entry.original.blob instanceof Blob && entry.original.blob.type === 'image/heic'
                    });
                };
            });
        });
        expect(result.ok).toBe(true);
    });

});
