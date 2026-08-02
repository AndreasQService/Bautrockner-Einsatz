/**
 * tasks.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Task logic for the office project control.
 *
 * DESIGN RULE:
 *   Tasks = concrete work items within a project phase.
 *   Tasks are NOT status changes.
 *
 *   Good tasks:    "Mieter kontaktieren", "Termin koordinieren", "Rechnung erstellen"
 *   Bad tasks:     "Status auf Leckortung setzen" (that is a status change, not a task)
 *
 * Auto-tasks: Derived from project data at runtime. Never stored to DB unless saved.
 * Manual tasks: Stored in officeTasks[] on the project record (or in project_tasks table).
 *
 * @typedef {import('./types.js').ProjectTask} ProjectTask
 * @typedef {import('./types.js').ProjectRecord} ProjectRecord
 */

import { getDaysSince, getDaysSinceLastMeasurement } from './statusRules.js';
import { toCanonical } from './statusTransitions.js';

// ─── Auto task generation ─────────────────────────────────────────────────────

/**
 * Derives automatic tasks from the current project state.
 * These are computed at runtime and never blindly saved to the DB.
 *
 * @param {ProjectRecord} project
 * @returns {ProjectTask[]}
 */
export const getAutoTasksForStatus = (project) => {
  const tasks = [];
  const canonical = toCanonical(project.status);

  if (canonical === 'trocknung') {
    const rRooms = project.measurementRooms || project.rooms || project.report_data?.measurementRooms || project.report_data?.rooms || [];
    const rAllRoomsCompleted = Array.isArray(rRooms) && rRooms.length > 0 && rRooms.every(rm => rm.dryingCompleted || rm.globalSettings?.dryingCompleted);
    const isDryingCompleted = !!(project.dryingCompleted || project.report_data?.dryingCompleted || rAllRoomsCompleted);

    if (!isDryingCompleted) {
      const mDays = getDaysSinceLastMeasurement(project);
      if (mDays !== null && mDays > 7) {
        tasks.push({
          id: 'measurement_overdue',
          projectId: project.id,
          title: `Feuchtekontrolle durchführen (letzte Messung vor ${mDays} Tagen)`,
          done: false,
          dueDate: null,
          category: 'auto',
          urgent: mDays > 10,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return tasks;
};

// ─── Merge auto + manual tasks ────────────────────────────────────────────────

/**
 * Returns all open tasks (auto-derived + manual).
 * Manual tasks stored in project.officeTasks[].
 * @param {ProjectRecord} project
 * @returns {ProjectTask[]}
 */
export const getAllOpenTasks = (project) => {
  const auto = getAutoTasksForStatus(project);
  const manual = (project.officeTasks || []).filter(t => !t.done);
  return [...auto, ...manual];
};

// ─── Counting ─────────────────────────────────────────────────────────────────

/**
 * @param {ProjectTask[]} tasks
 * @returns {number}
 */
export const getOpenTasksCount = (tasks) => tasks.filter(t => !t.done).length;

/**
 * A task is overdue if it has urgent=true, or if dueDate is in the past.
 * @param {ProjectTask[]} tasks
 * @param {Date} [now]
 * @returns {number}
 */
export const getOverdueTasksCount = (tasks, now = new Date()) => {
  return tasks.filter(t => {
    if (t.done) return false;
    if (t.urgent) return true;
    if (t.dueDate) return new Date(t.dueDate) < now;
    return false;
  }).length;
};
