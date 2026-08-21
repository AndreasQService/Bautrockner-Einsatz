import { openDB } from 'idb';

const DB_NAME = 'qtool-project-drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

let dbPromise;

function openDraftDatabase() {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB ist nicht verfügbar');
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
        }
      },
      blocked() {
        console.warn('[SafeProjectCreation] IndexedDB-Upgrade ist durch einen anderen Tab blockiert');
      },
      blocking() {
        void dbPromise?.then(db => db.close());
        dbPromise = undefined;
      },
      terminated() {
        dbPromise = undefined;
      },
    });
  }
  return dbPromise;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function saveProjectDraftWithReadback(project, actor = null) {
  if (!project?.id) throw new Error('Projekt-ID für lokalen Entwurf fehlt');
  const checksum = await sha256(project);
  const row = {
    projectId: project.id,
    state: 'cloud_pending',
    actor,
    project,
    checksum,
    updatedAt: new Date().toISOString(),
  };
  const db = await openDraftDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite', { durability: 'strict' });
  await tx.store.put(row);
  await tx.done;

  const readback = await db.get(STORE_NAME, project.id);
  if (!readback || readback.projectId !== project.id || readback.state !== 'cloud_pending') {
    throw new Error('Lokaler Projektentwurf konnte nicht rückgelesen werden');
  }
  if (readback.checksum !== checksum || await sha256(readback.project) !== checksum) {
    throw new Error('Prüfsumme des lokalen Projektentwurfs stimmt nicht');
  }
  return readback;
}

export async function confirmProjectDraftWithReadback(projectId) {
  const db = await openDraftDatabase();
  const existing = await db.get(STORE_NAME, projectId);
  if (!existing || existing.projectId !== projectId || !existing.checksum) {
    throw new Error('Lokaler Projektentwurf für Bestätigung fehlt');
  }
  const confirmed = { ...existing, state: 'cloud_confirmed', confirmedAt: new Date().toISOString() };
  const tx = db.transaction(STORE_NAME, 'readwrite', { durability: 'strict' });
  await tx.store.put(confirmed);
  await tx.done;
  const readback = await db.get(STORE_NAME, projectId);
  if (!readback || readback.state !== 'cloud_confirmed' || readback.checksum !== existing.checksum) {
    throw new Error('Lokale Cloud-Bestätigung konnte nicht rückgelesen werden');
  }
  return readback;
}

export async function listVerifiedPendingProjectDrafts() {
  const db = await openDraftDatabase();
  const rows = await db.getAll(STORE_NAME);
  const verified = [];

  for (const row of rows) {
    if (!row || row.state !== 'cloud_pending' || !row.projectId || !row.project || !row.checksum) continue;
    if (String(row.project.id || '') !== String(row.projectId)) continue;
    if (await sha256(row.project) !== row.checksum) continue;
    verified.push(row);
  }

  return verified.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

const firstRow = data => Array.isArray(data) ? data[0] : data;

export async function createProjectAtomically({
  supabase, project, sessionToken, device, clientId,
}) {
  if (!supabase || !project?.id) throw new Error('Cloud-Verbindung oder Projekt-ID fehlt');
  if (!sessionToken || String(sessionToken).length < 20) throw new Error('Bestätigtes Session-Token fehlt');

  const { data: createData, error: createError } = await supabase.rpc('create_project_and_acquire_lock', {
    p_project_id: project.id,
    p_report_data: project,
    p_session_token: sessionToken,
    p_device: device,
    p_client_id: clientId,
  });
  if (createError) throw new Error(`Atomare Projekterstellung nicht bestätigt: ${createError.message}`);
  const created = firstRow(createData);
  if (created?.created !== true || String(created?.project_id || '') !== String(project.id)) {
    throw new Error('Server hat die atomare Projekterstellung nicht bestätigt');
  }

  const { data: reportRow, error: reportError } = await supabase
    .from('damage_reports')
    .select('id, report_data, updated_at')
    .eq('id', project.id)
    .single();
  if (reportError || !reportRow || String(reportRow.id) !== String(project.id) || !reportRow.report_data) {
    throw new Error(`Datenbank-Readback nicht bestätigt${reportError?.message ? `: ${reportError.message}` : ''}`);
  }

  const { data: lockData, error: lockError } = await supabase.rpc('get_project_lock_status', {
    p_project_id: project.id,
    p_session_token: sessionToken,
  });
  const lock = firstRow(lockData);
  if (lockError || String(lock?.open_project_id || '') !== String(project.id) || lock?.is_owner !== true) {
    throw new Error(`Sperrbesitz nicht bestätigt${lockError?.message ? `: ${lockError.message}` : ''}`);
  }

  return {
    ...project,
    ...reportRow.report_data,
    id: project.id,
    _supabase_updated_at: reportRow.updated_at,
    _cloudSyncStatus: 'confirmed',
    _is_local_draft: false,
  };
}
