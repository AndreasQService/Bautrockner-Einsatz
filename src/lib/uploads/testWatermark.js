/**
 * testWatermark.js
 * Applies visible, indelible watermark pixels onto test images before blob storage.
 */

export const WATERMARK_TEXT = 'QTOOL TESTDATEN – NICHT PRODUKTIV';

/**
 * Stamps a visible red/white watermark banner onto an image File or Blob using HTML5 Canvas.
 * Returns a new File object with stamped pixels.
 *
 * @param {Blob|File} imageBlob
 * @param {string} originalFileName
 * @returns {Promise<File>} Stamped Image File
 */
export async function applyTestWatermark(imageBlob, originalFileName) {
  // Check if browser environment has Image & Canvas support
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return new File([imageBlob], originalFileName, { type: imageBlob.type || 'image/jpeg' });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          return resolve(new File([imageBlob], originalFileName, { type: imageBlob.type }));
        }

        // 1. Draw original image
        ctx.drawImage(img, 0, 0);

        // 2. Calculate dynamic banner size relative to image height
        const fontSize = Math.max(16, Math.floor(canvas.height * 0.04));
        const bannerHeight = fontSize * 2;

        // 3. Draw semi-transparent dark banner at bottom
        ctx.fillStyle = 'rgba(220, 38, 38, 0.85)'; // Red background
        ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight);

        // 4. Draw bold white watermark text
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(WATERMARK_TEXT, canvas.width / 2, canvas.height - (bannerHeight / 2));

        // 5. Export canvas blob
        const mimeType = imageBlob.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob((stampedBlob) => {
          URL.revokeObjectURL(url);
          if (!stampedBlob) {
            return reject(new Error('[WATERMARK ABORT] Canvas.toBlob fehlgeschlagen.'));
          }
          const stampedFile = new File([stampedBlob], originalFileName, { type: mimeType });
          resolve(stampedFile);
        }, mimeType, 0.92);

      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`[WATERMARK ABORT] Bild '${originalFileName}' konnte nicht geladen werden.`));
    };

    img.src = url;
  });
}
