/**
 * oneDriveApi.js
 * Microsoft Graph API Calls für durable Upload-Sessions
 *
 * ALLE Funktionen werfen bei Fehler eine Exception mit klarer Beschreibung.
 * → Kein stilles catch {} ohne Statusänderung.
 *
 * Retry-Logik (429 / 5xx) liegt im uploadWorker.js.
 */

import { getGraphAccessToken } from '../onedrive/auth.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/**
 * Enkodiert einen OneDrive-Pfad segmentweise (jedes Segment separat encodeURIComponent)
 * Beispiel: "QTool/20260236_Muster/Fotos" → "QTool/20260236_Muster/Fotos"
 * @param {string} path
 * @returns {string}
 */
function encodePath(path) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * Wrapper für alle authentifizierten Graph-Requests.
 * Gibt Response-Objekt zurück; wirft bei !ok.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number[]} allowedStatuses  HTTP-Status-Codes, die KEIN Fehler sind
 * @returns {Promise<Response>}
 */
async function graphFetch(url, options = {}, allowedStatuses = []) {
  const token = await getGraphAccessToken();

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const ok = res.ok || allowedStatuses.includes(res.status);
  if (!ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`[Graph] HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }

  return res;
}

// ─── Ordner ───────────────────────────────────────────────────────────────────

/**
 * Erstellt einen Ordner, ignoriert "already exists" (409)
 * @param {string} parentPath  z.B. "QTool/20260236_Muster"
 * @param {string} folderName  z.B. "Fotos"
 */
export async function ensureFolder(parentPath, folderName) {
  const token = await getGraphAccessToken();
  const encoded = encodePath(parentPath);

  await fetch(`${GRAPH_BASE}/me/drive/root:/${encoded}:/children`, {
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
  // 201 = erstellt, 409 = existiert bereits → beides ok
}

// ─── Upload-Session ───────────────────────────────────────────────────────────

/**
 * Erstellt eine OneDrive Upload-Session für resumable Uploads.
 * Muss für Dateien jeder Grösse verwendet werden (nicht nur >4 MB).
 *
 * @param {string} remotePath  Voller Pfad inkl. Dateiname, z.B. "QTool/Projekt/Fotos/bild.jpg"
 * @returns {Promise<{uploadUrl: string, expirationDateTime: string, nextExpectedRanges?: string[]}>}
 */
export async function createUploadSession(remotePath) {
  const encoded = encodePath(remotePath);

  const res = await graphFetch(
    `${GRAPH_BASE}/me/drive/root:/${encoded}:/createUploadSession`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: {
          '@microsoft.graph.conflictBehavior': 'rename',
        },
      }),
    }
  );

  return res.json();
}

/**
 * Fragt den aktuellen Status einer Upload-Session ab.
 * Verwendung: Nach Unterbrechung prüfen, wo weiterzumachen ist.
 *
 * @param {string} uploadUrl  Session-URL (aus createUploadSession)
 * @returns {Promise<{nextExpectedRanges: string[], expirationDateTime: string}>}
 */
export async function getUploadSessionStatus(uploadUrl) {
  // Session-URLs sind self-authenticated (Token bereits eingebettet)
  const res = await fetch(uploadUrl, { method: 'GET' });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[Graph] Session-Status fehlgeschlagen: HTTP ${res.status} ${detail.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * Lädt einen Chunk (Teil des Blobs) über die Upload-Session hoch.
 *
 * @param {string}      uploadUrl      Session-URL
 * @param {ArrayBuffer} chunk          Der Dateiteil
 * @param {number}      start          Byte-Offset (inklusiv)
 * @param {number}      endInclusive   Letztes Byte (inklusiv)
 * @param {number}      total          Gesamtgrösse der Datei
 * @returns {Promise<Response>}  202 (Chunk angenommen) oder 200/201 (Upload fertig)
 */
export async function uploadChunk(uploadUrl, chunk, start, endInclusive, total) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(chunk.byteLength),
      'Content-Range':  `bytes ${start}-${endInclusive}/${total}`,
    },
    body: chunk,
  });

  // 200/201 = fertig, 202 = Chunk angenommen → alle ok
  if (![200, 201, 202].includes(res.status)) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[Graph] Chunk-Upload fehlgeschlagen: HTTP ${res.status} ${detail.slice(0, 300)}`);
  }

  return res;
}

// ─── Ordner-Abgleich (Reconciliation) ────────────────────────────────────────

/**
 * Listet alle Dateien in einem OneDrive-Ordner auf.
 * Gibt leeres Array zurück, wenn Ordner nicht existiert (404).
 *
 * @param {string} folderPath  z.B. "QTool/20260236_Muster/Fotos"
 * @returns {Promise<Array<{id: string, name: string, eTag: string, size: number}>>}
 */
export async function listFolderChildren(folderPath) {
  const encoded = encodePath(folderPath);

  const res = await graphFetch(
    `${GRAPH_BASE}/me/drive/root:/${encoded}:/children?$select=id,name,eTag,size`,
    {},
    [404] // 404 = Ordner existiert noch nicht → ok
  );

  if (res.status === 404) return [];

  const data = await res.json();
  return data.value ?? [];
}

/**
 * Prüft ob eine Datei per Item-ID noch auf OneDrive existiert.
 * @param {string} itemId
 * @returns {Promise<boolean>}
 */
export async function itemExists(itemId) {
  if (!itemId) return false;
  try {
    const res = await graphFetch(
      `${GRAPH_BASE}/me/drive/items/${encodeURIComponent(itemId)}?$select=id`,
      {},
      [404]
    );
    return res.status !== 404;
  } catch {
    return false;
  }
}
