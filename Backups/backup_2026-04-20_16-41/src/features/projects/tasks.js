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
  const daysInStatus = getDaysSince(project.statusStartedAt || project.date) ?? 0;
  const hasContacts = project.contacts && project.contacts.length > 0;
  const hasRooms = project.rooms && project.rooms.length > 0;
  const hasImages = project.images && project.images.length > 0;
  const hasEquipment = project.equipment && project.equipment.length > 0;

  const task = (id, title, urgentAfterDays = Infinity) => ({
    id,
    projectId: project.id,
    title,
    done: false,
    dueDate: null,
    category: 'auto',
    urgent: daysInStatus >= urgentAfterDays,
    createdAt: new Date().toISOString(),
  });

  // ── Always: contacts ──────────────────────────────────────────────────────
  if (!hasContacts)
    tasks.push(task('missing_contacts', 'Kontakte erfassen (Mieter, Eigentümer, Hauswart)', 1));

  // ── eingang / kontakt ─────────────────────────────────────────────────────
  if (canonical === 'eingang' || canonical === 'kontakt') {
    tasks.push(task('contact_tenant', 'Mieter kontaktieren und Schadenmeldung aufnehmen', 1));
    tasks.push(task('schedule_aufnahme', 'Termin für Schadenaufnahme vereinbaren', 1));
  }

  // ── aufnahme ──────────────────────────────────────────────────────────────
  if (canonical === 'aufnahme') {
    if (!hasRooms)
      tasks.push(task('rooms_missing', 'Räume und betroffene Bereiche erfassen', 2));
    if (!hasImages)
      tasks.push(task('photos_missing', 'Fotos vom Schadenbild aufnehmen', 2));
    tasks.push(task('schedule_leckortung', 'Leckortungs-Termin koordinieren', 2));
  }

  // ── leckortung ────────────────────────────────────────────────────────────
  if (canonical === 'leckortung') {
    tasks.push(task('confirm_leak_appt', 'Termin für Leckortung bestätigen', 2));
    tasks.push(task('document_leak_result', 'Resultat der Leckortung dokumentieren', 3));
    tasks.push(task('create_report', 'Schadensbericht erstellen und an Auftraggeber senden', 4));
    tasks.push(task('decide_next', 'Weiteres Vorgehen entscheiden (Trocknung / Instandstellung)', 5));
  }

  // ── bericht ───────────────────────────────────────────────────────────────
  if (canonical === 'bericht') {
    tasks.push(task('finalize_report', 'Schadensbericht fertigstellen', 1));
    tasks.push(task('send_report', 'Bericht an Auftraggeber und Versicherung senden', 2));
    tasks.push(task('plan_next_phase', 'Nächste Phase planen (Trocknung / Instandstellung)', 3));
  }

  // ── trocknung ─────────────────────────────────────────────────────────────
  if (canonical === 'trocknung') {
    if (!hasEquipment)
      tasks.push(task('add_equipment', 'Trocknungsgeräte im System erfassen', 0));

    const dryStartDate = project.dryingStarted ||
      (project.equipment?.length ? project.equipment.map(e => e.startDate).filter(Boolean).sort()[0] : null) ||
      project.statusStartedAt || project.date;
    const dryDays = getDaysSince(dryStartDate) ?? 0;
    const mDays = getDaysSinceLastMeasurement(project);

    if (mDays === null && dryDays > 2)
      tasks.push(task('first_measurement', 'Erste Feuchtekontrolle durchführen', 0));
    else if (mDays !== null && mDays > 7)
      tasks.push({ ...task('measurement_overdue', `Feuchtekontrolle durchführen (letzte Messung vor ${mDays} Tagen)`, 7), urgent: mDays > 10 });

    if (dryDays >= 25)
      tasks.push(task('check_drying_end', 'Trocknungsabschluss prüfen → Geräte zurückziehen', 0));
  }

  // ── instandstellung ───────────────────────────────────────────────────────
  if (canonical === 'instandstellung') {
    tasks.push(task('coordinate_repair', 'Instandstellungs-Termin koordinieren', 3));
    tasks.push(task('finalize_repair', 'Instandstellung abschliessen und protokollieren', 7));
    tasks.push(task('prepare_invoice', 'Rechnung vorbereiten', 10));
  }

  // ── rechnung ─────────────────────────────────────────────────────────────
  if (canonical === 'rechnung') {
    const hasInvoice = project.images?.some(img => img.assignedTo === 'Sonstiges');
    if (!hasInvoice)
      tasks.push(task('create_invoice', 'Rechnung ausstellen und versenden', 0));
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
