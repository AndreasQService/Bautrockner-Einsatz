import { createVerifiedProjectSession } from './projectSessionStore.js';

const unwrap = data => Array.isArray(data) ? data[0] : data;

/** Atomically creates a project plus owner lease, then verifies cloud and local state. */
export async function createLockedProjectSession({
  supabase, project, sessionToken, device, clientId = null, actor = null,
  createLocalSession = createVerifiedProjectSession,
}) {
  if (!supabase) throw new Error('Supabase-Verbindung fehlt');
  if (!project?.id) throw new Error('Projekt-ID fehlt');
  if (!sessionToken || String(sessionToken).length < 20) throw new Error('Gültiges Besitzer-Session-Token fehlt');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Ein neues Projekt kann nur mit Internetverbindung erstellt werden');
  }
  const { data, error } = await supabase.rpc('create_project_and_acquire_lock', {
    p_project_id: String(project.id), p_report_data: project,
    p_session_token: String(sessionToken), p_device: String(device || 'Desktop'),
    p_client_id: clientId ? String(clientId) : null,
  });
  if (error) throw new Error(`Projekt/Sperre nicht atomar bestätigt: ${error.message}`);
  const result = unwrap(data);
  if (result?.created !== true || String(result?.project_id) !== String(project.id)
      || result?.offline_prepare_required !== true) {
    throw new Error('Ungültige Bestätigung der atomaren Projekterstellung');
  }
  const [{ data: reportRow, error: reportError }, { data: lockRows, error: lockError }] = await Promise.all([
    supabase.from('damage_reports').select('report_data, updated_at').eq('id', project.id).single(),
    supabase.rpc('get_project_lock_status', { p_project_id: project.id, p_session_token: sessionToken }),
  ]);
  if (reportError || !reportRow?.report_data) throw new Error(`Projekt-Readback fehlgeschlagen: ${reportError?.message || 'Datensatz fehlt'}`);
  if (lockError) throw new Error(`Sperr-Readback fehlgeschlagen: ${lockError.message}`);
  const owners = Array.isArray(lockRows) ? lockRows : [];
  if (owners.length !== 1 || owners[0]?.is_owner !== true
      || String(owners[0]?.open_project_id) !== String(project.id)) {
    throw new Error('Exklusive Eigentümersperre wurde nicht bestätigt');
  }
  const cloudProject = { ...project, ...reportRow.report_data, id: project.id, _supabase_updated_at: reportRow.updated_at, isLightweight: false };
  const baseVersion = Number(cloudProject.report_data?.version || cloudProject.version || 1);
  const localSession = await createLocalSession({
    project: cloudProject, lockToken: sessionToken, baseVersion, actor,
    device: String(device || 'Desktop').split(':')[0],
  });
  if (localSession?.state !== 'offline_available' || localSession?.projectId !== project.id || localSession?.lockToken !== sessionToken) {
    throw new Error('Lokale Offline-Verfügbarkeit wurde nicht bestätigt');
  }
  return { project: cloudProject, lock: owners[0], session: localSession, rpc: result };
}
