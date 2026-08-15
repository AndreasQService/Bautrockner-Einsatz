/**
 * statusActions.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central function for ALL project status updates.
 *
 * NEVER update project status directly in a component.
 * Always use updateProjectStatus() from this module.
 *
 * Responsibilities:
 *   1. Validate that the transition is allowed
 *   2. Update damage_reports.status + statusStartedAt + updated_at
 *   3. Append entry to statusHistory[] within report_data
 *   4. Write to project_status_history table (if it exists)
 *   5. Pre-generate auto-tasks for new status (stored in officeTasks[])
 *
 * @typedef {import('./types.js').ProjectRecord} ProjectRecord
 * @typedef {import('./types.js').ProjectStatus} ProjectStatus
 * @typedef {import('./types.js').StatusUpdateResult} StatusUpdateResult
 */

import { canTransitionTo, getTransitionLabel } from './statusTransitions.js';
import { getAutoTasksForStatus } from './tasks.js';
import { registerDomainMutation } from '../../lib/offline/domainMutationAdapter.js';

/**
 * Maps canonical status IDs back to the legacy strings used in damage_reports.
 * This bridges the new feature layer with the existing DB schema.
 */
const CANONICAL_TO_LEGACY = {
  eingang:         'Schadenaufnahme',  // closest legacy equivalent for new projects
  kontakt:         'Schadenaufnahme',
  aufnahme:        'Schadenaufnahme',
  leckortung:      'Leckortung',
  bericht:         'Leckortung',       // no dedicated bericht status in legacy DB
  trocknung:       'Trocknung',
  instandstellung: 'Instandsetzung',
  rechnung:        'Abgeschlossen',
};

/**
 * Updates a project's status.
 *
 * Steps performed atomically (best-effort; partial failures are logged):
 *   1. Validate transition
 *   2. Update report_data + indexed columns in damage_reports
 *   3. Append to statusHistory in report_data
 *   4. Write history row to project_status_history (if table exists)
 *   5. Merge auto-tasks into officeTasks[]
 *
 * @param {object} supabase          - Supabase client instance
 * @param {object} params
 * @param {string} params.projectId  - Project ID (damage_reports.id)
 * @param {ProjectStatus} params.newStatus - Canonical new status
 * @param {string} params.changedBy  - Name of user making the change
 * @param {string} [params.reason]   - Optional reason for the change
 * @returns {Promise<StatusUpdateResult>}
 */
export const updateProjectStatus = async (supabase, { projectId, newStatus, changedBy, reason }) => {
  // ── 1. Load current project ────────────────────────────────────────────────
  const { data: row, error: loadError } = await supabase
    .from('damage_reports')
    .select('report_data, status')
    .eq('id', projectId)
    .single();

  if (loadError || !row) {
    return { success: false, error: loadError?.message || 'Projekt nicht gefunden', project: null };
  }

  const currentProject = row.report_data;
  const currentStatus = currentProject?.status || row.status;

  // ── 2. Validate transition ─────────────────────────────────────────────────
  if (!canTransitionTo(currentStatus, newStatus)) {
    return {
      success: false,
      error: `Wechsel von "${currentStatus}" → "${getTransitionLabel(newStatus)}" ist nicht erlaubt.`,
      project: null,
    };
  }

  const now = new Date().toISOString();
  const legacyStatus = CANONICAL_TO_LEGACY[newStatus] || newStatus;

  // ── 3. Build history entry ─────────────────────────────────────────────────
  /** @type {import('./types.js').ProjectStatusHistoryEntry} */
  const historyEntry = {
    id: `sh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId,
    oldStatus: currentStatus,
    newStatus,
    changedAt: now,
    changedBy: changedBy || 'Büro',
    reason: reason || null,
  };

  // ── 4. Build updated project data ─────────────────────────────────────────
  // Merge new auto-tasks into existing officeTasks (avoid duplicates by id)
  const newAutoTasks = getAutoTasksForStatus({ ...currentProject, status: legacyStatus });
  const existingOffice = (currentProject.officeTasks || []);
  const existingIds = new Set(existingOffice.map(t => t.id));
  const freshTasks = newAutoTasks
    .filter(t => !existingIds.has(t.id))
    .map(t => ({ ...t, category: 'auto' }));

  const updatedProject = {
    ...currentProject,
    status:          legacyStatus,
    statusStartedAt: now,
    lastActivityAt:  now,
    officeTasks:     [...existingOffice, ...freshTasks],
    statusHistory:   [...(currentProject.statusHistory || []), historyEntry],
  };

  await registerDomainMutation({
    projectId,
    type: 'project.status.update',
    entityId: historyEntry.id,
    payload: {
      status: legacyStatus,
      project: updatedProject,
      updatedAt: now,
      historyEntry,
    },
    snapshot: updatedProject,
    actor: changedBy,
  });

  // ── 5. Save to Supabase ────────────────────────────────────────────────────
  const { error: saveError } = await supabase
    .from('damage_reports')
    .update({
      status:          legacyStatus,
      report_data:     updatedProject,
      updated_at:      now,
    })
    .eq('id', projectId);

  if (saveError) {
    return { success: false, error: saveError.message, project: null };
  }

  // ── 6. Write to project_status_history table (best-effort, table may not exist yet) ──
  try {
    await supabase.from('project_status_history').insert({
      project_id:  projectId,
      old_status:  currentStatus,
      new_status:  newStatus,
      changed_at:  now,
      changed_by:  changedBy || 'Büro',
      reason:      reason || null,
    });
  } catch (_) {
    // Table may not exist yet. Non-fatal — history is also stored in report_data.
    console.warn('[statusActions] project_status_history table not found (non-fatal)');
  }

  return { success: true, error: null, project: updatedProject };
};

/**
 * Convenience wrapper: marks a manual task as done.
 * @param {object} supabase
 * @param {string} projectId
 * @param {string} taskId
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
export const completeTask = async (supabase, projectId, taskId) => {
  const { data: row, error: loadError } = await supabase
    .from('damage_reports')
    .select('report_data')
    .eq('id', projectId)
    .single();

  if (loadError || !row) return { success: false, error: loadError?.message || 'Fehler' };

  const project = row.report_data;
  const updatedTasks = (project.officeTasks || []).map(t =>
    t.id === taskId ? { ...t, done: true, completedAt: new Date().toISOString() } : t
  );
  const updatedProject = { ...project, officeTasks: updatedTasks, lastActivityAt: new Date().toISOString() };

  await registerDomainMutation({
    projectId,
    type: 'project.task.complete',
    entityId: taskId,
    payload: { project: updatedProject },
    snapshot: updatedProject,
  });

  const { error } = await supabase
    .from('damage_reports')
    .update({
      report_data: updatedProject,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', projectId);

  return { success: !error, error: error?.message || null };
};
