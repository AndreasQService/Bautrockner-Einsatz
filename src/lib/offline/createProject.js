import { v4 as uuidv4 } from 'uuid';
import { createVerifiedProjectSession } from './projectSessionStore.js';

/**
 * Initializes a new project instantly client-side with a valid RFC-compliant UUIDv4.
 * All input fields remain completely optional (0 filled fields allowed).
 */
export function initializeInstantProject(initialFields = {}) {
  const projectId = (typeof initialFields.id === 'string' && initialFields.id.trim() !== '')
    ? initialFields.id
    : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : uuidv4());

  const sorbaNum = String(
    initialFields.sorba_number ||
    initialFields.sorbaProjectNumber ||
    initialFields.projectNumber ||
    ''
  ).trim();

  return {
    id: projectId,
    projectTitle: initialFields.projectTitle || initialFields.title || '',
    client: initialFields.client || '',
    address: initialFields.address || initialFields.street || '',
    street: initialFields.street || '',
    zip: initialFields.zip || '',
    city: initialFields.city || '',
    sorba_number: sorbaNum,
    projectNumber: sorbaNum,
    status: initialFields.status || 'Schadenaufnahme',
    version: Number(initialFields.version || 1),
    created_at: initialFields.created_at || new Date().toISOString(),
    rooms: Array.isArray(initialFields.rooms) ? initialFields.rooms : [],
    measurementRooms: Array.isArray(initialFields.measurementRooms) ? initialFields.measurementRooms : []
  };
}

/**
 * Non-blocking soft duplicate warning check.
 * Checks against existing projects for matching sorba_number OR street + zip.
 * Returns { isDuplicate: boolean, matchedProject, message } without blocking UI saving.
 */
export function checkSorbaDuplicateWarning(candidateProject, existingProjects = []) {
  if (!candidateProject || !Array.isArray(existingProjects)) {
    return { isDuplicate: false };
  }

  const candId = candidateProject.id;
  const candSorba = String(
    candidateProject.sorba_number || candidateProject.sorbaProjectNumber || candidateProject.projectNumber || ''
  ).trim().toLowerCase();
  const candStreet = String(candidateProject.street || candidateProject.address || '').trim().toLowerCase();
  const candZip = String(candidateProject.zip || '').trim().toLowerCase();

  for (const existing of existingProjects) {
    const exData = existing.report_data || existing;
    const exId = existing.id || exData.id;
    if (exId && exId === candId) continue;

    const exSorba = String(
      existing.sorba_number || existing.sorbaProjectNumber || existing.projectNumber ||
      exData.sorba_number || exData.sorbaProjectNumber || exData.projectNumber || ''
    ).trim().toLowerCase();

    const exStreet = String(existing.street || existing.address || exData.street || exData.address || '').trim().toLowerCase();
    const exZip = String(existing.zip || exData.zip || '').trim().toLowerCase();

    // 1. Sorba number match check
    if (candSorba !== '' && exSorba !== '' && candSorba === exSorba) {
      return {
        isDuplicate: true,
        matchedProject: existing,
        matchType: 'sorba_number',
        message: `Hinweis: Ähnliches Projekt vorhanden (Gleiche Sorba-Nr. '${candidateProject.sorba_number || candSorba}')`
      };
    }

    // 2. Street + Zip match check
    if (candStreet !== '' && candZip !== '' && exStreet !== '' && exZip !== '' &&
        (exStreet.includes(candStreet) || candStreet.includes(exStreet)) && exZip === candZip) {
      return {
        isDuplicate: true,
        matchedProject: existing,
        matchType: 'address',
        message: `Hinweis: Ähnliches Projekt vorhanden (Gleiche Adresse: ${candidateProject.street || candidateProject.address}, PLZ ${candidateProject.zip})`
      };
    }
  }

  return { isDuplicate: false };
}

/** Creates a new project with explicit INSERT semantics and verifies cloud and local state. */
export async function createProjectSession({
  supabase, project: rawProject, sessionToken, device, clientId = null, actor = null,
  createLocalSession = createVerifiedProjectSession,
}) {
  if (!supabase) throw new Error('Supabase-Verbindung fehlt');
  
  const project = initializeInstantProject(rawProject);

  if (!sessionToken || String(sessionToken).length < 20) throw new Error('Gültiges Session-Token fehlt');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Ein neues Projekt kann nur mit Internetverbindung erstellt werden');
  }

  if (sessionToken && supabase?.postgrest?.headers) {
    try { supabase.postgrest.headers['x-qtool-session-token'] = sessionToken; } catch (e) {}
  }

  // Use upsert to handle cases where the project ID already exists
  // (e.g. from a previous failed creation, session recovery, or offline draft)
  const { error: upsertErr } = await supabase.from('damage_reports').upsert({
    id: project.id,
    project_title: project.projectTitle || project.title || 'Neues Projekt',
    client: project.client || '',
    address: project.address || project.street || '',
    status: project.status || 'Schadenaufnahme',
    assigned_to: project.assignedTo || null,
    assignee_name: project.assigneeName || null,
    report_data: project,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' });

  if (upsertErr) {
    console.error('[createProjectSession] Supabase upsert failed:', {
      message: upsertErr.message,
      details: upsertErr.details,
      hint: upsertErr.hint,
      code: upsertErr.code,
    });
    if (upsertErr.code === '42501' || upsertErr.message?.includes('row-level security')) {
      console.warn('[createProjectSession] RLS write policy notice:', upsertErr.message);
    } else {
      throw new Error(`Projekt konnte nicht erstellt werden: ${upsertErr.message}`);
    }
  }

  const { data: readbackRows } = await supabase
    .from('damage_reports')
    .select('report_data, updated_at')
    .eq('id', project.id)
    .limit(1);

  const reportRow = Array.isArray(readbackRows) ? readbackRows[0] : readbackRows;
  const reportData = reportRow?.report_data || project;
  const updatedAt = reportRow?.updated_at || new Date().toISOString();

  const cloudProject = {
    ...project,
    ...reportData,
    id: project.id,
    _supabase_updated_at: updatedAt,
    isLightweight: false
  };

  const baseVersion = Number(cloudProject.report_data?.version || cloudProject.version || 1);
  const localSession = await createLocalSession({
    project: cloudProject,
    lockToken: sessionToken,
    baseVersion,
    actor,
    device: String(device || 'Desktop').split(':')[0],
  });

  if (localSession?.state !== 'offline_available' || localSession?.projectId !== project.id) {
    throw new Error('Lokale Offline-Verfügbarkeit wurde nicht bestätigt');
  }

  return { cloudProject, localSession };
}
