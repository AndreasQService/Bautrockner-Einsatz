/**
 * OneDriveService.js
 * Microsoft Graph API Integration für QTool
 *
 * Ordnerstruktur: OneDrive/QTool/[Projektnr]_[Strasse]_[Ort]/
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const ROOT_FOLDER = 'QTool';

// ─── Token ───────────────────────────────────────────────────────────────────

let _msalInstance = null;

export function setMsalInstance(instance) {
  _msalInstance = instance;
}

async function getAccessToken() {
  if (!_msalInstance) return null;
  const accounts = _msalInstance.getAllAccounts();
  if (!accounts.length) return null;
  try {
    const result = await _msalInstance.acquireTokenSilent({
      scopes: ['Files.ReadWrite.All'],
      account: accounts[0],
    });
    return result.accessToken;
  } catch {
    return null;
  }
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/**
 * Projektnummer + Adresse → sicherer Ordnername
 * z.B. "20260236_Musterstrasse5_Zuerich"
 */
export function buildProjectFolderName(projectNumber, formData) {
  const street = (formData?.street || formData?.schadenort?.strasse_nr || '').trim();
  const city   = (formData?.city   || formData?.schadenort?.ort         || '').trim();

  const safe = (str) => str
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const parts = [projectNumber, safe(street), safe(city)].filter(Boolean);
  return parts.join('_');
}

/**
 * Dateidatum → YYYY-MM-DD
 */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Core API ────────────────────────────────────────────────────────────────

async function graphFetch(path, options = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Kein OneDrive-Token verfügbar.');

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok && res.status !== 409) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Graph-Fehler ${res.status}: ${err?.error?.message || res.statusText}`);
  }
  return res;
}

/**
 * Ordner erstellen (ignoriert "already exists"-Fehler)
 */
async function ensureFolder(parentPath, folderName) {
  const token = await getAccessToken();
  if (!token) return;

  await fetch(`${GRAPH_BASE}/me/drive/root:/${parentPath}:/children`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    }),
  });
  // 409 = already exists → ok
}

/**
 * Datei hochladen (< 4 MB, einfacher Upload)
 * @param {string} driveFolder  z.B. "QTool/20260236_Muster_Zuerich/Fotos/Wohnzimmer"
 * @param {string} fileName     z.B. "20260236_Wohnzimmer_01.jpg"
 * @param {Blob|ArrayBuffer} content
 */
async function uploadFile(driveFolder, fileName, content) {
  const path = encodeURIComponent(`${driveFolder}/${fileName}`);
  await graphFetch(`/me/drive/root:/${path}:/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: content,
  });
}

// ─── Öffentliche API ─────────────────────────────────────────────────────────

/**
 * Projektordner + Unterordner anlegen
 */
export async function ensureProjectFolders(folderName) {
  if (!(await getAccessToken())) return;

  await ensureFolder(ROOT_FOLDER, folderName);
  const base = `${ROOT_FOLDER}/${folderName}`;
  await ensureFolder(base, 'Fotos');
  await ensureFolder(base, 'Dokumente');
  await ensureFolder(`${base}/Dokumente`, 'Plaene');
  await ensureFolder(`${base}/Dokumente`, 'Lieferantenrechnungen');
  await ensureFolder(`${base}/Dokumente`, 'Mails');
}

/**
 * PDF-Bericht hochladen
 * @param {string} folderName   Projektordner-Name
 * @param {string} reportType   'Schadensbericht' | 'Trockenbericht'
 * @param {Blob}   blob
 */
export async function uploadReport(folderName, reportType, blob) {
  if (!(await getAccessToken())) return;
  const fileName = `${reportType}_${todayStr()}.pdf`;
  await ensureProjectFolders(folderName);
  await uploadFile(`${ROOT_FOLDER}/${folderName}`, fileName, blob);
  console.log(`[OneDrive] ✅ ${fileName} hochgeladen`);
}

/**
 * Bild hochladen
 * @param {string} folderName   Projektordner-Name
 * @param {string} projectNr    Projektnummer für Dateiprefix
 * @param {string} subFolder    Raumname | 'Ursache' | 'Aussenbild'
 * @param {number} index        Laufnummer
 * @param {Blob}   blob
 * @param {string} ext          'jpg' | 'png'
 */
export async function uploadPhoto(folderName, projectNr, subFolder, index, blob, ext = 'jpg') {
  if (!(await getAccessToken())) return;

  const safe = (s) => s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
  const fileName = `${projectNr}_${safe(subFolder)}_${String(index).padStart(2, '0')}.${ext}`;
  const folder = `${ROOT_FOLDER}/${folderName}/Fotos/${safe(subFolder)}`;

  await ensureFolder(`${ROOT_FOLDER}/${folderName}/Fotos`, safe(subFolder));
  await uploadFile(folder, fileName, blob);
  console.log(`[OneDrive] ✅ Foto ${fileName} hochgeladen`);
}

/**
 * Bild hochladen — vereinfachte Version direkt mit File-Objekt
 * Dateiname: [subFolder]_[timestamp].[ext]
 */
export async function uploadPhotoFile(folderName, subFolder, file) {
  if (!(await getAccessToken())) return;
  const safe = (s) => (s || 'Sonstiges').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
  const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
  const fileName = `${safe(subFolder)}_${Date.now()}.${ext}`;
  const folder = `${ROOT_FOLDER}/${folderName}/Fotos/${safe(subFolder)}`;
  await ensureFolder(`${ROOT_FOLDER}/${folderName}/Fotos`, safe(subFolder));
  await uploadFile(folder, fileName, file);
  console.log(`[OneDrive] ✅ Foto ${fileName} hochgeladen`);
}


/**
 * Excel-Protokoll hochladen
 */
export async function uploadExcel(folderName, blob) {
  if (!(await getAccessToken())) return;
  const fileName = `Messprotokoll_${todayStr()}.xlsx`;
  await ensureProjectFolders(folderName);
  await uploadFile(`${ROOT_FOLDER}/${folderName}`, fileName, blob);
  console.log(`[OneDrive] ✅ ${fileName} hochgeladen`);
}

/**
 * E-Mail-Text als .txt ablegen
 */
export async function uploadMailText(folderName, text) {
  if (!(await getAccessToken())) return;
  const fileName = `Import_${todayStr()}.txt`;
  const blob = new Blob([text], { type: 'text/plain' });
  await ensureProjectFolders(folderName);
  await uploadFile(`${ROOT_FOLDER}/${folderName}/Dokumente/Mails`, fileName, blob);
  console.log(`[OneDrive] ✅ Mail ${fileName} abgelegt`);
}

/**
 * Dokument (Plan, Rechnung, etc.) hochladen
 * @param {string} subFolder  'Plaene' | 'Lieferantenrechnungen'
 */
export async function uploadDocument(folderName, subFolder, fileName, blob) {
  if (!(await getAccessToken())) return;
  await ensureProjectFolders(folderName);
  await uploadFile(`${ROOT_FOLDER}/${folderName}/Dokumente/${subFolder}`, fileName, blob);
  console.log(`[OneDrive] ✅ Dokument ${fileName} abgelegt`);
}

/**
 * Projektdaten als JSON sichern (automatisch beim Speichern)
 * Bilder-Blobs (base64/blob-URLs) werden herausgefiltert.
 */
export async function uploadProjectJson(folderName, projectData) {
  if (!(await getAccessToken())) return;

  // Bilder-Blobs entfernen damit die Datei klein bleibt
  const clean = {
    ...projectData,
    damageTypeImage: projectData.damageTypeImage?.startsWith('data:') ? null : projectData.damageTypeImage,
    exteriorPhoto: projectData.exteriorPhoto?.startsWith('data:') ? null : projectData.exteriorPhoto,
    images: (projectData.images || []).map(img => ({
      ...img,
      preview: (img.preview?.startsWith('blob:') || img.preview?.startsWith('data:')) ? null : img.preview,
    })),
    _backedUpAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  await ensureProjectFolders(folderName);
  await uploadFile(`${ROOT_FOLDER}/${folderName}`, 'Projektdaten.json', blob);
  console.log(`[OneDrive] ✅ Projektdaten.json gesichert`);
}
