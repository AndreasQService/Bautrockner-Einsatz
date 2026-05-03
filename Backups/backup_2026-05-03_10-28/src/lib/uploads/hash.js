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
  const hashBuf   = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
