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
        if (!blob || !(blob instanceof Blob)) {
            reject(new Error('Invalid image blob provided for compressSingleImage'));
            return;
        }

        if (blob.size === 0) {
            reject(new Error('Image blob is empty (0 bytes)'));
            return;
        }

        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
            try {
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;

                if (!width || !height) {
                    URL.revokeObjectURL(url);
                    reject(new Error('Image has 0 width or height'));
                    return;
                }

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
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        };

        img.onerror = () => {
            console.warn('[imageCompressor] ⚠️ Image load into Canvas failed. Details:', {
                blobSize: blob?.size,
                blobType: blob?.type,
                blobUrl: url
            });
            URL.revokeObjectURL(url);
            reject(new Error(`Failed to load image into Canvas (type: ${blob?.type || 'unknown'}, size: ${blob?.size || 0} bytes)`));
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

import { sha256OfBlob } from '../lib/uploads/hash.js';

/**
 * Calculates SHA-256 hash of a Blob
 */
export async function calculateSha256(blob) {
    return sha256OfBlob(blob);
}

/**
 * Processes a single file through the compression pipeline sequentially.
 * Prevents multiple large images from occupying memory concurrently.
 */
export function queueImageCompression(file, isSketch = false) {
    if (!file || !(file instanceof Blob)) {
        return Promise.reject(new Error(`[imageCompressor] Invalid file provided: ${file}`));
    }

    // Add to the sequential promise queue
    const task = compressionQueue.then(async () => {
        let fileName = file.name;
        if (!fileName || fileName === 'undefined' || fileName === 'null') {
            fileName = 'image.jpg';
        }
        const fileType = file.type || '';
        console.log(`[imageCompressor] 🔄 Processing image compression for: ${fileName} (size: ${file.size || 0} bytes, type: ${fileType || 'unknown'})`);
        
        const isHeic = fileName.toLowerCase().endsWith('.heic') || fileName.toLowerCase().endsWith('.heif') || fileType.includes('heic') || fileType.includes('heif');
        const isPdf = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
        const isImage = fileType.startsWith('image/') || isHeic || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(fileName);
        
        let originalBlob = file;
        const originalSha = await calculateSha256(originalBlob);

        // Non-image files (PDFs, documents) skip canvas image compression
        if (isPdf || !isImage) {
            console.log(`[imageCompressor] 📄 Non-image file detected (${fileName}, type: ${fileType}). Skipping canvas compression.`);
            return {
                original: { blob: originalBlob, sha256: originalSha, size: originalBlob.size, mimeType: fileType || 'application/octet-stream' },
                compressed: { blob: originalBlob, sha256: originalSha, size: originalBlob.size, mimeType: fileType || 'application/octet-stream' },
                pdf: { blob: originalBlob, sha256: originalSha, size: originalBlob.size, mimeType: fileType || 'application/octet-stream' },
                preview: { blob: originalBlob, size: originalBlob.size, mimeType: fileType || 'application/octet-stream' }
            };
        }

        const lossless = isSketch || isLossless(fileName, fileType);
        
        let compressedBlob = originalBlob;
        let pdfBlob = originalBlob;
        let previewBlob = originalBlob;

        try {
            // Determine if it is already small and doesn't need re-processing
            // Small: longest edge <= 2048px and size < 2MB (2097152 bytes) and not HEIC
            let needsRecompression = true;
            
            if (originalBlob.size < 2097152 && !isHeic && !lossless) {
                try {
                    const dims = await new Promise((resolve, reject) => {
                        const u = URL.createObjectURL(originalBlob);
                        const i = new Image();
                        i.onload = () => {
                            resolve({ w: i.width, h: i.height });
                            URL.revokeObjectURL(u);
                        };
                        i.onerror = (err) => {
                            URL.revokeObjectURL(u);
                            reject(new Error(`Dimension check failed for ${fileName}`));
                        };
                        i.src = u;
                    });
                    if (dims.w <= 2048 && dims.h <= 2048) {
                        needsRecompression = false;
                    }
                } catch (e) {
                    needsRecompression = true;
                }
            }
            
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
        } catch (compressionErr) {
            const errDetail = compressionErr?.message || (compressionErr?.type ? `DOM Event (${compressionErr.type})` : String(compressionErr));
            console.warn(`[imageCompressor] ⚠️ Canvas compression failed for ${fileName} (${errDetail}). Falling back to original blob.`);
            compressedBlob = originalBlob;
            pdfBlob = originalBlob;
            previewBlob = originalBlob;
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
        const errDetail = err?.message || (err?.type ? `DOM Event (${err.type})` : String(err));
        console.warn('[imageCompressor] ⚠️ Compression queue error handled:', errDetail);
    });
    
    return task;
}
