/**
 * imageCompressor.js
 * resizes, rotates, and compresses images for QTool
 * handles JPEG, PNG, WebP, and HEIC
 */

let compressionQueue = Promise.resolve();

/**
 * Strips metadata, rotates, scales and compresses an image using a canvas.
 * @param {Blob|File} blob
 * @param {number} maxDimension
 * @param {number} quality (0 to 1)
 * @param {string} format 'image/jpeg' | 'image/png'
 * @returns {Promise<Blob>}
 */
export function compressSingleImage(blob, maxDimension, quality, format = 'image/jpeg') {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
            try {
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;

                // Scale down if exceeding max dimension, keeping aspect ratio
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    URL.revokeObjectURL(url);
                    reject(new Error('Canvas context not available'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((resultBlob) => {
                    // Cleanup canvas and image to prevent memory leaks on iPad
                    canvas.width = 0;
                    canvas.height = 0;
                    URL.revokeObjectURL(url);

                    if (resultBlob) {
                        resolve(resultBlob);
                    } else {
                        reject(new Error('Canvas conversion to Blob returned null'));
                    }
                }, format, quality);
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
            }
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };

        img.src = url;
    });
}

/**
 * Checks if a file is lossless format (sketches, transparent WebP, or explicitly labeled lossless)
 */
export function isLossless(filename, mimeType) {
    const fn = (filename || '').toLowerCase();
    const mt = (mimeType || '').toLowerCase();
    return fn.includes('sketch') || 
           fn.includes('skizze') || 
           fn.includes('plan') || 
           mt.includes('png') || 
           (mt.includes('webp') && !mt.includes('lossy'));
}

/**
 * Calculates SHA-256 hash of a Blob
 */
export async function calculateSha256(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Processes a single file through the compression pipeline sequentially.
 * Prevents multiple large images from occupying memory concurrently.
 */
export function queueImageCompression(file, isSketch = false) {
    // Add to the sequential promise queue
    const task = compressionQueue.then(async () => {
        console.log(`[imageCompressor] 🔄 Processing image compression for: ${file.name}`);
        
        const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type.includes('heic') || file.type.includes('heif');
        const lossless = isSketch || isLossless(file.name, file.type);
        
        let originalBlob = file;
        
        // 1. Calculate original details
        const originalSha = await calculateSha256(originalBlob);
        
        // Determine if it is already small and doesn't need re-processing
        // Small: longest edge <= 2048px and size < 2MB (2097152 bytes) and not HEIC
        let needsRecompression = true;
        
        // Since we can't easily read dimensions without loading, we load it if we need to check.
        // But for safety, if size is < 2MB, and it is a standard JPEG/PNG, we can read size directly.
        if (originalBlob.size < 2097152 && !isHeic && !lossless) {
            // Check dimensions using a quick image load
            try {
                const dims = await new Promise((resolve, reject) => {
                    const u = URL.createObjectURL(originalBlob);
                    const i = new Image();
                    i.onload = () => {
                        resolve({ w: i.width, h: i.height });
                        URL.revokeObjectURL(u);
                    };
                    i.onerror = () => {
                        reject();
                        URL.revokeObjectURL(u);
                    };
                    i.src = u;
                });
                if (dims.w <= 2048 && dims.h <= 2048) {
                    needsRecompression = false;
                }
            } catch (e) {
                // If dimensions reading fails, recompress to be safe
                needsRecompression = true;
            }
        }
        
        let compressedBlob = originalBlob;
        let pdfBlob = originalBlob;
        let previewBlob = originalBlob;
        
        if (lossless) {
            // For sketches/lossless diagrams, compress to WebP or PNG lossless
            compressedBlob = await compressSingleImage(originalBlob, 2048, 1.0, 'image/png');
            pdfBlob = await compressSingleImage(originalBlob, 1600, 1.0, 'image/png');
            previewBlob = await compressSingleImage(originalBlob, 480, 0.8, 'image/png');
        } else if (needsRecompression || isHeic) {
            // Compress main photo (JPEG quality 82%)
            compressedBlob = await compressSingleImage(originalBlob, 2048, 0.82, 'image/jpeg');
            // PDF version (1600px quality 78%)
            pdfBlob = await compressSingleImage(originalBlob, 1600, 0.78, 'image/jpeg');
            // UI preview version (480px quality 70%)
            previewBlob = await compressSingleImage(originalBlob, 480, 0.70, 'image/jpeg');
        } else {
            // Already small, generate only PDF version and preview to be efficient
            pdfBlob = await compressSingleImage(originalBlob, 1600, 0.78, 'image/jpeg');
            previewBlob = await compressSingleImage(originalBlob, 480, 0.70, 'image/jpeg');
        }
        
        const compressedSha = await calculateSha256(compressedBlob);
        const pdfSha = await calculateSha256(pdfBlob);
        
        return {
            original: {
                blob: originalBlob,
                sha256: originalSha,
                size: originalBlob.size,
                mimeType: originalBlob.type || 'image/jpeg'
            },
            compressed: {
                blob: compressedBlob,
                sha256: compressedSha,
                size: compressedBlob.size,
                mimeType: lossless ? 'image/png' : 'image/jpeg'
            },
            pdf: {
                blob: pdfBlob,
                sha256: pdfSha,
                size: pdfBlob.size,
                mimeType: lossless ? 'image/png' : 'image/jpeg'
            },
            preview: {
                blob: previewBlob,
                size: previewBlob.size,
                mimeType: lossless ? 'image/png' : 'image/jpeg'
            }
        };
    });
    
    // Chain the queue
    compressionQueue = task.then(() => {}, (err) => {
        console.error('[imageCompressor] ❌ Compression queue error:', err);
    });
    
    return task;
}
