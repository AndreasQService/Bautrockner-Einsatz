import { sha256OfBlob } from './uploads/hash.js';

export const createPhotoId = (uuidFactory = () => globalThis.crypto.randomUUID()) => `img_${uuidFactory()}`;
export const calculatePhotoContentHash = file => sha256OfBlob(file);
export async function createPhotoIdentity(file, uuidFactory) {
  return { id: createPhotoId(uuidFactory), contentHash: await calculatePhotoContentHash(file) };
}

export async function createOneDrivePhotoFile(photo, blob) {
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error('ONEDRIVE_SOURCE_BLOB_MISSING');
  if (photo?.convertedFromHeic === true) {
    const technicalId = String(photo.id || photo.recoveryKey || photo.contentHash || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!technicalId) throw new Error('ONEDRIVE_TECHNICAL_ID_MISSING');
    const signature = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
    if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) throw new Error('ONEDRIVE_CONVERTED_JPEG_INVALID');
    return new File([blob], `${technicalId}.jpg`, { type: 'image/jpeg' });
  }
  return new File([blob], photo?.cloudFileName || photo?.name || 'foto.jpg', { type: blob.type || 'image/jpeg' });
}
