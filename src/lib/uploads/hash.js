/**
 * hash.js
 * SHA-256 Fingerprinting für Blobs
 *
 * Wird verwendet, um identische Dateien zu erkennen und
 * nach dem Upload die Integrität zu prüfen.
 */

/**
 * Berechnet den SHA-256 Hash eines Blobs
 * Nutzt die native Web Crypto API – kein Polyfill nötig.
 * @param {Blob} blob
 * @returns {Promise<string>} Hex-String (64 Zeichen)
 */
export async function sha256OfBlob(blob) {
  const buffer    = await blob.arrayBuffer();

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Fallback if Web Crypto API is not available (e.g. non-secure HTTP context)
    let h1 = 0x811c9dc5;
    let h2 = 0xcbf29ce4;
    const view = new Uint8Array(buffer);
    for (let i = 0; i < view.length; i++) {
      h1 = Math.imul(h1 ^ view[i], 0x01000193);
      h2 = Math.imul(h2 ^ view[i], 0x09000193);
    }
    const p1 = Math.abs(h1).toString(16).padStart(8, '0');
    const p2 = Math.abs(h2).toString(16).padStart(8, '0');
    const p3 = Math.abs(h1 ^ h2).toString(16).padStart(8, '0');
    const p4 = Math.abs(h1 + h2).toString(16).padStart(8, '0');
    const p5 = Math.abs(h1 - h2).toString(16).padStart(8, '0');
    const p6 = Math.abs(h1 * h2).toString(16).padStart(8, '0');
    const p7 = Math.abs(h1 ^ ~h2).toString(16).padStart(8, '0');
    const p8 = Math.abs(h2 ^ ~h1).toString(16).padStart(8, '0');
    return (p1 + p2 + p3 + p4 + p5 + p6 + p7 + p8).slice(0, 64);
  }

  const hashBuf   = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
