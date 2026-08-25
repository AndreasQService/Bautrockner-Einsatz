const DOCUMENT_EXTENSIONS = ['.msg', '.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.csv'];
const NON_TEXT_CATEGORIES = new Set([
  'id', 'report_data', 'images', 'photos', 'equipment', 'devices',
  'exteriorPhoto', 'exteriorPhotoDeleted', 'exteriorPhotoStoragePath', 'exteriorPhotoOneDriveItemId', 'exteriorPhotoOneDrivePath',
  'address', 'date', 'imageCount', 'version', 'updated_at', 'created_at', 'isLightweight',
  'last_edited_by', 'last_edited_device', 'last_edited_client_id', 'last_edited_at'
]);

const canonicalJson = value => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

const isDocument = item => {
  if (!item || item.type === 'document') return true;
  const name = String(item.name || '').toLowerCase();
  return DOCUMENT_EXTENSIONS.some(extension => name.endsWith(extension));
};

export const itemKey = (item, index) => String(item?.id || item?.supabasePath || item?.storagePath || `${item?.name || 'item'}:${item?.date || item?.createdAt || ''}:${item?.size || ''}:${index}`);

const uniqueItems = items => {
  const seen = new Set();
  return items.filter((item, index) => {
    const key = itemKey(item, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const measurementSetHasValues = measurements => Array.isArray(measurements) && measurements.some(measurement => {
  const wall = measurement?.w_value ?? measurement?.w ?? measurement?.wand ?? measurement?.wall ?? measurement?.W;
  const floor = measurement?.b_value ?? measurement?.b ?? measurement?.boden ?? measurement?.floor ?? measurement?.B;
  return String(wall ?? '').trim() !== '' || String(floor ?? '').trim() !== '';
});

export const getProjectProtocolPayloads = report => {
  const rooms = [...(Array.isArray(report?.measurementRooms) ? report.measurementRooms : []), ...(Array.isArray(report?.rooms) ? report.rooms : [])];
  const seenRooms = new Set();
  const payloads = [];
  rooms.forEach((room, roomIndex) => {
    const roomKey = String(room?.id || `${room?.apartment || ''}:${room?.name || ''}:${roomIndex}`);
    if (seenRooms.has(roomKey)) return;
    seenRooms.add(roomKey);
    if (measurementSetHasValues(room?.measurementData?.measurements)) payloads.push(room.measurementData);
    if (Array.isArray(room?.measurementHistory)) payloads.push(...room.measurementHistory.filter(entry => measurementSetHasValues(entry?.measurements || entry?.points || entry?.measurementPoints)));
    if (measurementSetHasValues(room?.measurements)) payloads.push({ measurements: room.measurements });
    if (measurementSetHasValues(room?.measurementPoints)) payloads.push({ measurements: room.measurementPoints });
    if (measurementSetHasValues(room?.points)) payloads.push({ measurements: room.points });
  });
  return payloads;
};

export const getProjectPhotoCandidates = report => uniqueItems([
  ...(Array.isArray(report?.images) ? report.images : []),
  ...(Array.isArray(report?.photos) ? report.photos : []),
  ...(report?.exteriorPhoto && report?.exteriorPhotoDeleted !== true ? [{
    id: 'exterior-photo',
    name: 'Aussenfoto',
    url: report.exteriorPhoto,
    storagePath: report.exteriorPhotoStoragePath,
    oneDriveItemId: report.exteriorPhotoOneDriveItemId,
    oneDrivePath: report.exteriorPhotoOneDrivePath,
    oneDriveSyncedAt: report.exteriorPhotoOneDriveSyncedAt
  }] : [])
].filter(item => !isDocument(item) && item?.assignedTo !== 'Messprotokolle'));

export const getProjectPhotoEvidenceKey = (report, photo) => {
  if (!photo) return null;
  const candidates = getProjectPhotoCandidates(report);
  const photoId = photo.id != null ? String(photo.id) : '';
  const photoPath = String(photo.supabasePath || photo.storagePath || '');
  const matches = candidates.map((candidate, index) => ({ candidate, index })).filter(({ candidate }) => {
    const candidateId = candidate?.id != null ? String(candidate.id) : '';
    if (photoId && candidateId) return photoId === candidateId;
    const candidatePath = String(candidate?.supabasePath || candidate?.storagePath || '');
    if (photoPath && candidatePath) return photoPath === candidatePath;
    return String(candidate?.name || '') === String(photo.name || '')
      && String(candidate?.date || candidate?.createdAt || '') === String(photo.date || photo.createdAt || '')
      && String(candidate?.size || '') === String(photo.size || '');
  });
  return matches.length === 1 ? itemKey(matches[0].candidate, matches[0].index) : null;
};

const stripProtocolDataFromRoom = room => Object.fromEntries(Object.entries(room || {}).filter(([key]) => ![
  'measurementData', 'measurementHistory', 'measurements', 'measurementPoints', 'points', 'canvasImage', 'sketch', 'protocolUrl'
].includes(key)));

const compactSemanticEmpty = value => {
  if (Array.isArray(value)) {
    const items = value.map(compactSemanticEmpty).filter(item => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, compactSemanticEmpty(item)])
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (value === undefined || value === null || value === '') return undefined;
  return value;
};

const textPayload = report => {
  const payload = Object.fromEntries(Object.entries(report || {})
    .filter(([key]) => !NON_TEXT_CATEGORIES.has(key) && !key.startsWith('_')));
  payload.damageType = report?.damageType ?? report?.type ?? '';
  payload.rooms = (Array.isArray(report?.rooms) ? report.rooms : []).map(stripProtocolDataFromRoom);
  payload.measurementRooms = (Array.isArray(report?.measurementRooms) ? report.measurementRooms : []).map(stripProtocolDataFromRoom);
  return compactSemanticEmpty(payload) || {};
};

export const reportCategoryMatches = (localReport, remoteReport) => ({
  text: canonicalJson(textPayload(localReport)) === canonicalJson(textPayload(remoteReport)),
  protocols: canonicalJson(getProjectProtocolPayloads(localReport)) === canonicalJson(getProjectProtocolPayloads(remoteReport)),
  devices: canonicalJson(localReport?.equipment || localReport?.devices || []) === canonicalJson(remoteReport?.equipment || remoteReport?.devices || [])
});

const makeCount = (label, total, synced) => ({
  label, total, synced, complete: total === 0 || synced === total,
  text: total === 0 ? `${label}: 0 von 0 (keine vorhanden)` : `${label}: ${synced} von ${total} synchronisiert`
});

export function getProjectSyncSummary(report, evidence = {}) {
  const photos = getProjectPhotoCandidates(report);
  const protocols = getProjectProtocolPayloads(report);
  const devices = Array.isArray(report?.equipment) ? report.equipment : (Array.isArray(report?.devices) ? report.devices : []);
  const verifiedPhotoKeys = new Set(evidence.verifiedPhotoKeys || []);
  const verifiedDeviceKeys = new Set(evidence.verifiedDeviceKeys || []);
  const rows = [
    makeCount('Fotos', photos.length, photos.filter((item, index) => verifiedPhotoKeys.has(itemKey(item, index))).length),
    makeCount('Messprotokolle', protocols.length, evidence.protocolsVerified ? protocols.length : 0),
    makeCount('Texte / Projektdaten', 1, evidence.textVerified ? 1 : 0),
    makeCount('Geräte', devices.length, devices.filter((item, index) => verifiedDeviceKeys.has(itemKey(item, index))).length)
  ];
  return { rows, complete: rows.every(row => row.complete) && evidence.textVerified === true };
}

export { canonicalJson };
