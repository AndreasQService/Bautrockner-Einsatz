/**
 * dryingCheckService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SCOPE: Genau eine Funktion.
 *
 * Wenn eine gültige Trocknungskontroll-Messung gespeichert wird, aktualisiert
 * diese Funktion die büro-relevanten Felder im Projekt-Datenobjekt.
 *
 * WAS SIE TUT:
 *   - lastDryingCheckAt setzen
 *   - nextDryingCheckDueAt auf measuredAt + 7 Tage setzen
 *   - Offene Trocknungskontroll-Aufgabe als erledigt markieren
 *   - Neue Folgeaufgabe mit Fälligkeit in 7 Tagen anlegen
 *
 * WAS SIE NICHT TUT:
 *   - Status ändern (currentStatus bleibt unverändert)
 *   - Projekt aus Trocknung bewegen
 *   - Supabase direkter Speicherung — sie gibt nur das geänderte Objekt zurück
 *
 * BEDINGUNGEN:
 *   - measurementType === 'drying_control'  (oder wird vom Trocknung-Status abgeleitet)
 *   - documentationComplete === true
 *   - project.status === 'Trocknung'
 *
 * @param {object} project        - Aktuelles Projekt-Datenblobject (report_data)
 * @param {object} measurementInfo
 * @param {string} measurementInfo.measuredAt        - ISO timestamp der Messung
 * @param {boolean} measurementInfo.documentationComplete - Muss true sein, sonst nichts
 * @param {string} [measurementInfo.measurementType] - Typ ('drying_control' oder leer bei Trocknung)
 * @returns {object|null} - Aktualisiertes Projektobjekt, oder null wenn Bedingungen nicht erfüllt
 */
export const applyDryingCheck = (project, measurementInfo) => {
  const { measuredAt, documentationComplete, measurementType } = measurementInfo;

  console.log('[dryingCheckService] applyDryingCheck input:', {
    projectId: project.id,
    projectStatus: project.status,
    documentationComplete,
    measuredAt,
    measurementType
  });

  // ── Defensive checks ────────────────────────────────────────────────────────

  // Nur für Trocknung-Projekte
  if (project.status !== 'Trocknung') {
    console.log('[dryingCheckService] rejected: status is not Trocknung');
    return null;
  }

  // Nur wenn Dokumentation vollständig
  if (!documentationComplete) {
    console.log('[dryingCheckService] rejected: documentationComplete is false');
    return null;
  }

  // Nur wenn kein expliziter Typ gesetzt ist, oder der Typ passt
  // (Im bestehenden System gibt es keinen measurementType-Enum — wir akzeptieren fehlendes Feld)
  if (measurementType && measurementType !== 'drying_control') {
    console.log('[dryingCheckService] rejected: mismatching measurementType');
    return null;
  }

  if (!measuredAt) return null;

  const allRoomsCompleted = Array.isArray(project.measurementRooms) &&
                            project.measurementRooms.length > 0 &&
                            project.measurementRooms.every(r => r.dryingCompleted);
  const isDryingCompleted = !!(project.dryingCompleted || allRoomsCompleted);

  // If drying is completed, mark all open tasks as done and don't create new ones
  if (isDryingCompleted) {
    const MEASUREMENT_TASK_IDS = [
      'first_measurement',
      'measurement_due',
      'measurement_overdue',
      'measurement_missing',
    ];
    const existingTasks = project.officeTasks || [];
    const updatedTasks = existingTasks.map(task => {
      const isDryingTask = MEASUREMENT_TASK_IDS.includes(task.id) ||
                           task.id === 'measurement_followup' ||
                           (task.id && String(task.id).startsWith('measurement_followup'));
      if (!task.done && isDryingTask) {
        return { ...task, done: true, completedAt: measuredAt };
      }
      return task;
    });

    return {
      ...project,
      dryingCompleted: true,
      lastDryingCheckAt:    measuredAt,
      nextDryingCheckDueAt: null,
      lastActivityAt:       measuredAt,
      officeTasks:          updatedTasks
    };
  }

  const measuredDate = new Date(measuredAt);
  if (isNaN(measuredDate.getTime())) return null;

  // ── Berechne next due date: measuredAt + 7 Tage ─────────────────────────────
  const nextDue = new Date(measuredDate);
  nextDue.setDate(nextDue.getDate() + 7);
  const nextDueAt = nextDue.toISOString();

  // ── Bestehende officeTasks aktualisieren ─────────────────────────────────────
  const MEASUREMENT_TASK_IDS = [
    'first_measurement',
    'measurement_due',
    'measurement_overdue',
    'measurement_missing',
  ];

  const existingTasks = project.officeTasks || [];

  // Markiere passende offene Aufgaben als erledigt
  const updatedTasks = existingTasks.map(task => {
    const isDryingTask = MEASUREMENT_TASK_IDS.includes(task.id) ||
                         task.id === 'measurement_followup' ||
                         (task.id && String(task.id).startsWith('measurement_followup'));
    if (!task.done && isDryingTask) {
      return { ...task, done: true, completedAt: measuredAt };
    }
    return task;
  });

  // Neue Folgeaufgabe hinzufügen (nur wenn noch keine offene mit gleichem Due-Datum existiert)
  const alreadyHasFollowUp = updatedTasks.some(
    t => !t.done && (t.id === 'measurement_followup' || (t.id && String(t.id).startsWith('measurement_followup'))) && t.dueDate === nextDueAt
  );

  if (!alreadyHasFollowUp) {
    updatedTasks.push({
      id: `measurement_followup_${Date.now()}`,
      projectId: project.id,
      title: `Nächste Feuchtekontrolle durchführen (fällig ${nextDue.toLocaleDateString('de-CH')})`,
      done: false,
      dueDate: nextDueAt,
      category: 'auto',
      urgent: false,
      createdAt: measuredAt,
    });
  }

  // ── Rückgabe: nur die büro-relevanten Felder aktualisiert ────────────────────
  return {
    ...project,
    lastDryingCheckAt:    measuredAt,
    nextDryingCheckDueAt: nextDueAt,
    lastActivityAt:       measuredAt,
    officeTasks:          updatedTasks,
    // EXPLIZIT: status wird NICHT verändert
  };
};
