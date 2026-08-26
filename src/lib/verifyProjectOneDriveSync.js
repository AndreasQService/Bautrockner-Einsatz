import { getProjectPhotoCandidates, itemKey, reportCategoryMatches } from './projectSyncSummary.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_READ_TIMEOUT_MS = 5000;

const safeFolderPart = value => String(value || '')
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
  .replace(/ß/g, 'ss').replace(/[^a-zA-Z0-9]/g, '_')
  .replace(/_+/g, '_').replace(/^_|_$/g, '');

export const projectOneDriveFolder = report => {
  const number = report?.projectNumber || report?.id || 'Unbekannt';
  const street = report?.street || report?.schadenort?.strasse_nr || '';
  const city = report?.city || report?.schadenort?.ort || '';
  return [number, safeFolderPart(street), safeFolderPart(city)].filter(Boolean).join('_');
};

const encodeDrivePath = path => String(path).split('/').filter(Boolean).map(encodeURIComponent).join('/');

const graphJson = async (fetchImpl, token, resource) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GRAPH_READ_TIMEOUT_MS);
  let response;
  try {
    response = await fetchImpl(`${GRAPH_BASE}${resource}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('ONEDRIVE_GRAPH_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error(`OneDrive-Readback fehlgeschlagen (${response.status}).`);
  return response.json();
};

const readProjectJson = async (fetchImpl, token, report) => {
  const path = `QTool/${projectOneDriveFolder(report)}/Projektdaten.json`;
  const metadata = await graphJson(fetchImpl, token, `/me/drive/root:/${encodeDrivePath(path)}:?$select=id,name,size,file,parentReference`);
  if (!metadata?.id || metadata?.name !== 'Projektdaten.json' || !metadata?.file || !(Number(metadata.size) > 0)) {
    throw new Error('OneDrive-Projektdaten wurden nicht als Datei bestätigt.');
  }
  const response = await fetchImpl(`${GRAPH_BASE}/me/drive/items/${encodeURIComponent(metadata.id)}/content`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`OneDrive-Projektdaten konnten nicht gelesen werden (${response.status}).`);
  return response.json();
};

const basename = path => String(path || '').split('/').filter(Boolean).pop() || '';

const verifyPhotoItem = async (fetchImpl, token, photo) => {
  const id = String(photo?.oneDriveItemId || '').trim();
  const path = String(photo?.oneDrivePath || '').trim();
  if (!id && !path) return false;
  const resource = id
    ? `/me/drive/items/${encodeURIComponent(id)}?$select=id,name,size,file,parentReference`
    : `/me/drive/root:/${encodeDrivePath(path)}:?$select=id,name,size,file,parentReference`;
  const metadata = await graphJson(fetchImpl, token, resource);
  if (!metadata?.id || !metadata?.file || !(Number(metadata.size) > 0)) return false;
  if (id && metadata.id !== id) return false;
  if (path && metadata.name !== basename(path)) return false;
  return true;
};

/**
 * Fresh, silent-only OneDrive verification. Local ids and paths are locators,
 * never evidence: every green count requires a successful Graph readback.
 */
export async function verifyProjectOneDriveSync({ report, tokenProvider, fetchImpl = fetch }) {
  if (!report?.id) throw new Error('Projekt fehlt für die OneDrive-Prüfung.');
  const resolveToken = tokenProvider || (async () => {
    const auth = await import('./onedrive/auth.js');
    return auth.getGraphAccessTokenSilent();
  });
  const token = await resolveToken();
  if (!token) throw new Error('OneDrive nicht verbunden – stille Prüfung ausstehend.');

  let matches = { text: false, protocols: false, devices: false };
  try {
    const remoteReport = await readProjectJson(fetchImpl, token, report);
    matches = reportCategoryMatches(report, remoteReport);
  } catch {
    // A missing/stale project JSON keeps text, protocol and device evidence
    // pending, but must not prevent independent photo readbacks.
  }
  const photos = getProjectPhotoCandidates(report);
  const verifiedPhotoKeys = [];
  const photoResults = [];
  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const key = itemKey(photo, index);
    const locator = photo?.oneDriveItemId || photo?.oneDrivePath || null;
    if (!locator) {
      photoResults.push({ key, id: photo?.id || null, name: photo?.name || null, storagePath: photo?.storagePath || photo?.supabasePath || null, verified: false, reason: 'MISSING_ONEDRIVE_LOCATOR' });
      continue;
    }
    try {
      const verified = await verifyPhotoItem(fetchImpl, token, photo);
      if (verified) verifiedPhotoKeys.push(key);
      photoResults.push({ key, id: photo?.id || null, name: photo?.name || null, storagePath: photo?.storagePath || photo?.supabasePath || null, verified, reason: verified ? null : 'STALE_ONEDRIVE_LOCATOR' });
    } catch (error) {
      photoResults.push({ key, id: photo?.id || null, name: photo?.name || null, storagePath: photo?.storagePath || photo?.supabasePath || null, verified: false, reason: error?.message === 'ONEDRIVE_GRAPH_TIMEOUT' ? 'ONEDRIVE_GRAPH_TIMEOUT' : 'ONEDRIVE_GRAPH_ERROR', detail: error?.message || String(error) });
      // One missing/stale photo remains pending without invalidating fresh
      // evidence already obtained for the other objects.
    }
  }
  const devices = Array.isArray(report?.equipment) ? report.equipment : (Array.isArray(report?.devices) ? report.devices : []);
  return {
    verifiedPhotoKeys,
    photoResults,
    verifiedDeviceKeys: matches.devices ? devices.map(itemKey) : [],
    textVerified: matches.text,
    protocolsVerified: matches.protocols,
    verifiedAt: new Date().toISOString()
  };
}
