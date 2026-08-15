import { sha256OfBlob } from '../uploads/hash.js';

export const QTOOL_IMAGE_POLICY = Object.freeze({
  maxDimension: 1920,
  quality: 0.78,
  mimeType: 'image/jpeg',
  minDimension: 16,
  maxBytes: 20 * 1024 * 1024,
});

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Bild kann nicht dekodiert werden'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Bildkomprimierung lieferte keine Datei')),
    mimeType,
    quality,
  ));
}

export async function inspectImageBlob(blob) {
  if (!(blob instanceof Blob) || blob.size === 0) throw new TypeError('Bilddatei fehlt oder ist leer');
  const { image, url } = await loadImage(blob);
  try {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
      throw new Error('Bilddimensionen sind ungültig');
    }
    return { width, height, size: blob.size, mimeType: blob.type || 'application/octet-stream' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Der Original-Blob lebt nur während dieses Aufrufs. Persistiert wird genau eine
 * ausgerichtete, komprimierte JPEG-Arbeitsversion.
 */
export async function prepareImageForDurableStorage(file, policy = QTOOL_IMAGE_POLICY) {
  if (!(file instanceof Blob) || file.size === 0) throw new TypeError('Originalbild fehlt oder ist leer');
  const isHeic = /image\/hei[cf]/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '');
  let decodableSource = file;
  if (isHeic) {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: policy.quality });
    decodableSource = Array.isArray(converted) ? converted[0] : converted;
    if (!(decodableSource instanceof Blob) || decodableSource.size === 0) {
      throw new Error('HEIC-Konvertierung ist fehlgeschlagen');
    }
  }
  const { image, url } = await loadImage(decodableSource);
  let canvas;
  try {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (sourceWidth < policy.minDimension || sourceHeight < policy.minDimension) {
      throw new Error(`Bild ist zu klein (${sourceWidth}x${sourceHeight})`);
    }
    const scale = Math.min(1, policy.maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas-Kontext ist nicht verfügbar');
    // Browser berücksichtigt beim Dekodieren die EXIF-Ausrichtung; Canvas
    // normalisiert sie in die ausgegebene JPEG-Datei und entfernt Metadaten.
    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, policy.mimeType, policy.quality);
    const verified = await inspectImageBlob(blob);
    if (verified.width !== width || verified.height !== height) {
      throw new Error('Lokale Bildverifikation meldet abweichende Dimensionen');
    }
    if (blob.size <= 0 || blob.size > policy.maxBytes) {
      throw new Error(`Komprimierte Bildgrösse ist unzulässig (${blob.size} Bytes)`);
    }
    const checksum = await sha256OfBlob(blob);
    if (!/^[a-f0-9]{64}$/i.test(checksum)) throw new Error('SHA-256-Prüfsumme ist ungültig');
    const baseName = String(file.name || 'image').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const durableFile = new File([blob], `${baseName}.jpg`, { type: policy.mimeType, lastModified: Date.now() });
    return {
      file: durableFile,
      checksum,
      width,
      height,
      size: durableFile.size,
      mimeType: policy.mimeType,
      sourceSize: file.size,
    };
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    URL.revokeObjectURL(url);
  }
}
