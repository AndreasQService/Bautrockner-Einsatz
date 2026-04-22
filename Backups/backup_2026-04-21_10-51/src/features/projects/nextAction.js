/**
 * nextAction.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns the single most important concrete action for each project.
 *
 * RULES:
 *   1. If there are overdue tasks → surface the most urgent one.
 *   2. Otherwise derive from status + project state.
 *   3. Always return a concrete VERB phrase (not vague status descriptions).
 *
 * BAD:  "Leckortung durchführen"
 * GOOD: "Termin für Leckortung vereinbaren und bestätigen"
 *
 * @typedef {import('./types.js').ProjectRecord} ProjectRecord
 * @typedef {import('./types.js').ProjectTask} ProjectTask
 */

import { toCanonical } from './statusTransitions.js';
import { getDaysSince, getDaysSinceLastMeasurement } from './statusRules.js';

/**
 * @param {ProjectRecord} project
 * @param {ProjectTask[]} allOpenTasks - Pre-computed open tasks (auto + manual)
 * @returns {{ action: string, icon: string }}
 */
export const getNextAction = (project, allOpenTasks = []) => {
  // Priority 1: Surface the most urgent overdue task by title
  const overdueTasks = allOpenTasks.filter(t => t.urgent && !t.done);
  if (overdueTasks.length > 0) {
    return { action: overdueTasks[0].title, icon: '⚠️' };
  }

  const canonical = toCanonical(project.status);
  const daysInStatus = getDaysSince(project.statusStartedAt || project.date) ?? 0;
  const hasContacts = project.contacts && project.contacts.length > 0;
  const hasRooms = project.rooms && project.rooms.length > 0;
  const hasEquipment = project.equipment && project.equipment.length > 0;
  const mDays = getDaysSinceLastMeasurement(project);

  // Priority 2: Missing contacts (always critical)
  if (!hasContacts)
    return { action: 'Kontakte erfassen (Mieter, Eigentümer, Hauswart)', icon: '📋' };

  // Priority 3: Status-specific action
  switch (canonical) {
    case 'eingang':
    case 'kontakt':
      return { action: 'Mieter kontaktieren und Termin für Aufnahme vereinbaren', icon: '📞' };

    case 'aufnahme':
      if (!hasRooms)
        return { action: 'Räume und betroffene Bereiche im System erfassen', icon: '🏠' };
      if (daysInStatus >= 2)
        return { action: 'Termin für Schadenaufnahme vereinbaren und bestätigen', icon: '📅' };
      return { action: 'Schadenaufnahme vorbereiten und Begehung terminieren', icon: '📅' };

    case 'leckortung':
      if (project.reportCreated)
        return { action: 'Bericht liegt vor – nächsten Schritt planen', icon: '✅' };
      if (daysInStatus >= 5)
        return { action: 'Schadensbericht erstellen und an Auftraggeber senden', icon: '📄' };
      if (daysInStatus >= 3)
        return { action: 'Termin für Leckortung bestätigen und Resultat dokumentieren', icon: '🔍' };
      return { action: 'Termin für Leckortung koordinieren', icon: '🔍' };

    case 'bericht':
      if (project.reportCreated)
        return { action: 'Bericht liegt vor – nächsten Schritt planen', icon: '✅' };
      if (daysInStatus >= 3)
        return { action: 'Bericht fertigstellen und sofort senden', icon: '📄' };
      return { action: 'Schadensbericht erstellen und an Auftraggeber senden', icon: '📄' };

    case 'trocknung': {
      if (!hasEquipment)
        return { action: 'Trocknungsgeräte im System erfassen', icon: '💨' };
      if (mDays !== null && mDays > 7)
        return { action: 'Feuchtekontrolle durchführen und Messung eintragen', icon: '📊' };
      const dryStart = project.dryingStarted ||
        (project.equipment?.length ? project.equipment.map(e => e.startDate).filter(Boolean).sort()[0] : null) ||
        project.statusStartedAt || project.date;
      const dryDays = getDaysSince(dryStart) ?? 0;
      if (dryDays >= 25)
        return { action: 'Trocknungsabschluss prüfen → Geräte zurückziehen und Status setzen', icon: '✅' };
      return { action: 'Nächste Feuchtekontrolle planen und Messergebnis eintragen', icon: '📊' };
    }

    case 'instandstellung':
      if (daysInStatus >= 10)
        return { action: 'Rechnung vorbereiten und unverzüglich ausstellen', icon: '💰' };
      if (daysInStatus >= 5)
        return { action: 'Instandstellung abschliessen und dokumentieren', icon: '🔧' };
      return { action: 'Instandstellungs-Termin koordinieren', icon: '🔧' };

    case 'rechnung': {
      const hasInvoice = project.images?.some(img => img.assignedTo === 'Sonstiges');
      if (!hasInvoice)
        return { action: 'Rechnung ausstellen und an Auftraggeber senden', icon: '💰' };
      return { action: 'Projektabschluss prüfen und archivieren', icon: '✅' };
    }

    default:
      return { action: 'Projektstatus prüfen – Phase unklar', icon: '⚠️' };
  }
};
