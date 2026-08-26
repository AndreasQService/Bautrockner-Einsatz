/**
 * imageCompressor.js
 * resizes, rotates, and compresses images for QTool
 * handles JPEG, PNG, WebP, and HEIC
 */

let compressionQueue = Promise.resolve();
export const IMAGE_DECODE_TIMEOUT_MS = 5000;

export const convertHeicToJpeg = async (blob, converter = null) => {
    const runConverter = converter || (async input => {
        const module = await import('heic2any');
        return module.default(input);
    });
    const converted = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('HEIC_CONVERSION_TIMEOUT')), IMAGE_DECODE_TIMEOUT_MS);
        Promise.resolve(runConverter({ blob, toType: 'image/jpeg', quality: 0.9 })).then(
            value => { clearTimeout(timer); resolve(value); },
            error => { clearTimeout(timer); reject(error); }
        );
    });
    const jpeg = Array.isArray(converted) ? converted[0] : converted;
    if (!(jpeg instanceof Blob) || jpeg.size === 0) throw new Error('HEIC_CONVERSION_EMPTY');
    const normalized = jpeg.type === 'image/jpeg' ? jpeg : new Blob([jpeg], { type: 'image/jpeg' });
    const signature = new Uint8Array(await normalized.slice(0, 3).arrayBuffer());
    if (signature[0] !== 0xFF || signature[1] !== 0xD8 || signature[2] !== 0xFF) throw new Error('HEIC_CONVERSION_INVALID_JPEG');
    return normalized;
};

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
        let settled = false;
        const finish = (callback) => {
            if (settled) return;
            settled = true;
            clearTimeout(decodeTimeout);
            URL.revokeObjectURL(url);
            callback();
        };
        const decodeTimeout = setTimeout(() => {
            try { img.src = ''; } catch (_) {}
            finish(() => reject(new Error(`Image decode timed out after ${IMAGE_DECODE_TIMEOUT_MS}ms (type: ${blob?.type || 'unknown'}, size: ${blob?.size || 0} bytes)`)));
        }, IMAGE_DECODE_TIMEOUT_MS);

        img.onload = () => {
            try {
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;

                if (!width || !height) {
                    finish(() => reject(new Error('Image has 0 width or height')));
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
                    finish(() => reject(new Error('Canvas context not available')));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((resultBlob) => {
                    // Cleanup canvas and image to prevent memory leaks on iPad
                    canvas.width = 0;
                    canvas.height = 0;

                    if (resultBlob) {
                        finish(() => resolve(resultBlob));
                    } else {
                        finish(() => reject(new Error('Canvas conversion to Blob returned null')));
                    }
                }, format, quality);
            } catch (err) {
                finish(() => reject(err instanceof Error ? err : new Error(String(err))));
            }
        };

        img.onerror = (evt) => {
            console.warn('[imageCompressor] ⚠️ Image load into Canvas failed. Details:', {
                blobSize: blob?.size,
                blobType: blob?.type,
                blobUrl: url
            });
            const detail = evt?.type ? `DOM Event (${evt.type})` : 'Image load error';
            finish(() => reject(new Error(`Failed to load image into Canvas (${detail}, type: ${blob?.type || 'unknown'}, size: ${blob?.size || 0} bytes)`)));
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
        
        const originalBlob = file;
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
        let workingBlob = originalBlob;
        if (isHeic) {
            try {
                workingBlob = await convertHeicToJpeg(originalBlob);
            } catch (error) {
                const conversionError = new Error(`HEIC_CONVERSION_FAILED: ${error?.message || String(error)}`);
                conversionError.code = 'HEIC_CONVERSION_FAILED';
                throw conversionError;
            }
        }
        
        let compressedBlob = workingBlob;
        let pdfBlob = workingBlob;
        let previewBlob = workingBlob;

        try {
            // Determine if it is already small and doesn't need re-processing
            // Small: longest edge <= 2048px and size < 2MB (2097152 bytes) and not HEIC
            let needsRecompression = true;
            
            if (workingBlob.size < 2097152 && !isHeic && !lossless) {
                try {
                    const dims = await new Promise((resolve, reject) => {
                        const u = URL.createObjectURL(workingBlob);
                        const i = new Image();
                        let settled = false;
                        const finish = (callback) => {
                            if (settled) return;
                            settled = true;
                            clearTimeout(timeoutId);
                            URL.revokeObjectURL(u);
                            callback();
                        };
                        const timeoutId = setTimeout(() => {
                            try { i.src = ''; } catch (_) {}
                            finish(() => reject(new Error(`Dimension check timed out for ${fileName}`)));
                        }, IMAGE_DECODE_TIMEOUT_MS);
                        i.onload = () => {
                            finish(() => resolve({ w: i.width, h: i.height }));
                        };
                        i.onerror = (err) => {
                            finish(() => reject(new Error(`Dimension check failed for ${fileName}`)));
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
                compressedBlob = await compressSingleImage(workingBlob, 2048, 1.0, 'image/png');
                pdfBlob = await compressSingleImage(workingBlob, 1600, 1.0, 'image/png');
                previewBlob = await compressSingleImage(workingBlob, 480, 0.8, 'image/png');
            } else if (needsRecompression || isHeic) {
                // Compress main photo (JPEG quality 82%)
                compressedBlob = await compressSingleImage(workingBlob, 2048, 0.82, 'image/jpeg');
                // PDF version (1600px quality 78%)
                pdfBlob = await compressSingleImage(workingBlob, 1600, 0.78, 'image/jpeg');
                // UI preview version (480px quality 70%)
                previewBlob = await compressSingleImage(workingBlob, 480, 0.70, 'image/jpeg');
            } else {
                // Already small, generate only PDF version and preview to be efficient
                pdfBlob = await compressSingleImage(workingBlob, 1600, 0.78, 'image/jpeg');
                previewBlob = await compressSingleImage(workingBlob, 480, 0.70, 'image/jpeg');
            }
        } catch (compressionErr) {
            const errDetail = compressionErr?.message || (compressionErr?.type ? `DOM Event (${compressionErr.type})` : String(compressionErr));
            const unreadable = new Error(`IMAGE_DECODE_UNREADABLE: Datei beschädigt oder nicht lesbar – erneut auswählen (${fileName})`);
            unreadable.code = 'IMAGE_DECODE_UNREADABLE';
            throw unreadable;
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
            },
            convertedFromHeic: isHeic,
            cloudExtension: isHeic ? 'jpg' : null
        };
    });
    
    // Chain the queue
    compressionQueue = task.then(() => {}, (err) => {
        const errDetail = err?.message || (err?.type ? `DOM Event (${err.type})` : String(err));
        console.warn('[imageCompressor] ⚠️ Compression queue error handled:', errDetail);
    });
    
    return task;
}
