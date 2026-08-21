const decodeStoragePath = (value) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

export const getCaseFileStoragePath = (photo = {}) => {
    const directPath = photo.supabasePath || photo.storagePath;
    if (typeof directPath === 'string' && directPath.trim()) {
        return decodeStoragePath(directPath.trim().replace(/^\/+/, ''));
    }

    const candidateUrl = photo.url || photo.preview;
    if (typeof candidateUrl !== 'string') return null;

    const marker = '/case-files/';
    const markerIndex = candidateUrl.indexOf(marker);
    if (markerIndex < 0) return null;

    const rawPath = candidateUrl.slice(markerIndex + marker.length).split(/[?#]/, 1)[0];
    return rawPath ? decodeStoragePath(rawPath) : null;
};

export const getDurablePhotoUrl = (photo = {}) => {
    const candidateUrl = photo.url || photo.preview;
    return typeof candidateUrl === 'string' && /^https:\/\//i.test(candidateUrl)
        ? candidateUrl
        : null;
};
