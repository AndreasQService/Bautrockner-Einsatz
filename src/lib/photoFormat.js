const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);

export function isHeicHeifPhoto(photo = {}) {
  const mimeCandidates = [
    photo.type, photo.mimeType, photo.contentType,
    photo.file?.type, photo.blob?.type,
    photo.original?.mimeType, photo.original?.blob?.type,
    photo.compressed?.mimeType, photo.compressed?.blob?.type
  ].map(value => String(value || '').toLowerCase());
  if (mimeCandidates.some(mime => HEIC_MIME_TYPES.has(mime) || mime.includes('heic') || mime.includes('heif'))) return true;

  return [photo.name, photo.fileName, photo.filename, photo.storagePath, photo.supabasePath, photo.oneDrivePath, photo.url]
    .some(value => /\.(?:heic|heif)(?:$|[?#])/i.test(String(value || '')));
}
