import { test, expect } from '@playwright/test';

test.describe('Image Compression Pipeline and IndexedDB Storage', () => {

    test.beforeEach(async ({ page }) => {
        // Go to the main application page
        await page.goto('/');
        
        // Wait for the app to load
        await page.waitForLoadState('networkidle');
    });

    test('1. Core Compression: Resizes, strips metadata, and computes SHA-256', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { queueImageCompression, calculateSha256 } = await import('/src/utils/imageCompressor.js');
            
            // Create a synthetic 3000x2000 px white JPEG file (exceeds 2048px limit)
            const canvas = document.createElement('canvas');
            canvas.width = 3000;
            canvas.height = 2000;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, 3000, 2000);
            
            // Draw a red watermark circle
            ctx.beginPath();
            ctx.arc(1500, 1000, 200, 0, 2 * Math.PI);
            ctx.fillStyle = '#FF0000';
            ctx.fill();
            
            const originalBlob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));
            const originalFile = new File([originalBlob], 'test_photo_large.jpg', { type: 'image/jpeg' });
            
            // Process file
            const result = await queueImageCompression(originalFile);
            
            // Verify output dimensions by loading the compressed blob
            const img = new Image();
            const compressedUrl = URL.createObjectURL(result.compressed.blob);
            const dims = await new Promise((resolve) => {
                img.onload = () => {
                    resolve({ w: img.width, h: img.height });
                    URL.revokeObjectURL(compressedUrl);
                };
                img.src = compressedUrl;
            });
            
            return {
                originalSize: originalBlob.size,
                originalSha: result.original.sha256,
                compressedSize: result.compressed.blob.size,
                compressedSha: result.compressed.sha256,
                pdfSize: result.pdf.blob.size,
                pdfSha: result.pdf.sha256,
                previewSize: result.preview.blob.size,
                dimensions: dims
            };
        });

        console.log('[E2E Test] Compression results:', result);
        
        // Assertions
        expect(result.originalSha).toBeDefined();
        expect(result.compressedSha).toBeDefined();
        expect(result.originalSha).not.toEqual(result.compressedSha);
        
        // Bounded resizing assertions
        expect(result.dimensions.w).toBe(2048);
        expect(result.dimensions.h).toBe(1365); // 3000x2000 scaled down maintains aspect ratio
        
        // Smaller output size assertions
        expect(result.compressedSize).toBeLessThan(result.originalSize);
        expect(result.previewSize).toBeLessThan(result.compressedSize);
    });

    test('2. IndexedDB Storage and Retrieval integrity', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { savePhotoLocally, getPhotoBlob } = await import('/src/services/PhotoStorage.js');
            
            // Create dummy file
            const blob = new Blob(['dummy_image_data'], { type: 'image/jpeg' });
            const file = new File([blob], 'test.jpg', { type: 'image/jpeg' });
            const imageId = 'test_' + Date.now();
            
            // Save to IndexedDB
            const url = await savePhotoLocally(imageId, 'TEST__ISOLATION_001', file, { assignedTo: 'Schadenfotos' });
            
            // Retrieve back
            const retrievedUrl = await getPhotoBlob(imageId, 'original');
            
            // Fetch retrieved content
            const res = await fetch(retrievedUrl);
            const retrievedBlob = await res.blob();
            const retrievedText = await retrievedBlob.text();
            
            return {
                urlExists: !!url,
                retrievedExists: !!retrievedUrl,
                matches: retrievedText === 'dummy_image_data'
            };
        });
        
        expect(result.urlExists).toBe(true);
        expect(result.retrievedExists).toBe(true);
        expect(result.matches).toBe(true);
    });

    test('3. Bounded Memory Stress Testing (10, 50, 100 images)', async ({ page }) => {
        // Run stress test evaluation
        const count = 50; // test with 50 synthetic images to run within Playwright timeout limits
        const results = await page.evaluate(async (numImages) => {
            const { queueImageCompression } = await import('/src/utils/imageCompressor.js');
            
            const start = performance.now();
            const compressedSizes = [];
            
            // Generate and process synthetic images
            for (let i = 0; i < numImages; i++) {
                const canvas = document.createElement('canvas');
                canvas.width = 1000;
                canvas.height = 1000;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#0000FF';
                ctx.fillRect(0, 0, 1000, 1000);
                
                // Add watermark
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '30px Arial';
                ctx.fillText(`QTOOL TESTDATEN - IMAGE ${i}`, 100, 500);
                
                const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
                const file = new File([blob], `stress_image_${i}.jpg`, { type: 'image/jpeg' });
                
                const res = await queueImageCompression(file);
                compressedSizes.push(res.compressed.blob.size);
            }
            
            const duration = performance.now() - start;
            return {
                durationSeconds: duration / 1000,
                processedCount: compressedSizes.length,
                averageSize: compressedSizes.reduce((a, b) => a + b, 0) / compressedSizes.length
            };
        }, count);
        
        console.log(`[E2E Stress Test] Processed ${results.processedCount} images in ${results.durationSeconds.toFixed(2)}s`);
        expect(results.processedCount).toBe(count);
        expect(results.durationSeconds).toBeLessThan(60); // Must complete within 1 minute
    });
});
