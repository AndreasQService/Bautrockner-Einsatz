/**
 * statusRules.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CENTRAL configuration for all status-based timing rules.
 *
 * DESIGN RULE:
 *   Status = broad project phase — keep it lean.
 *   Do NOT create a new status for every micro-step.
 *   Micro-steps are Tasks.
 *
 * HOW TO ADJUST THRESHOLDS:
 *   Edit the STATUS_RULES object below. No other files need changing.
 *
 * @typedef {import('./types.js').ProjectStatus} ProjectStatus
 * @typedef {import('./types.js').ProjectPriority} ProjectPriority
 */

// ─── Status label map (canonical status id → display label) ──────────────────

/** @type {Record<string, string>} */
export const STATUS_LABELS = {
  eingang:         'Eingang',
  kontakt:         'Kontakt',
  aufnahme:        'Schadenaufnahme',
  leckortung:      'Leckortung',
  bericht:         'Bericht',
  trocknung:       'Trocknung',
  instandstellung: 'Instandstellung',
  rechnung:        'Rechnung / Abschluss',
  // Legacy values stored in existing damage_reports
  Schadenaufnahme: 'Schadenaufnahme',
  Leckortung:      'Leckortung',
  Trocknung:       'Trocknung',
  Instandsetzung:  'Instandstellung',
  Instandstellung: 'Instandstellung',
  Abgeschlossen:   'Abgeschlossen',
};

/**
 * Normalises any status string (including legacy values) to canonical form.
 * @param {string} raw
 * @returns {ProjectStatus}
 */
export const normaliseStatus = (raw) => {
  const map = {
    'Schadenaufnahme': 'aufnahme',
    'Leckortung':      'leckortung',
    'Trocknung':       'trocknung',
    'Instandsetzung':  'instandstellung',
    'Instandstellung': 'instandstellung',
    'Abgeschlossen':   'rechnung',
  };
  return map[raw] || raw || 'eingang';
};

// ─── Timing rules per status ──────────────────────────────────────────────────

/**
 * Central timing thresholds.
 * yellowAfterDays: days until priority becomes YELLOW
 * redAfterDays:    days until priority becomes RED
 *
 * Override here only — no other if/else chains in the codebase.
 */
export const STATUS_RULES = /** @type {const} */ ({
  eingang:         { yellowAfterDays: 1,  redAfterDays: 2  },
  kontakt:         { yellowAfterDays: 1,  redAfterDays: 3  },
  aufnahme:        { yellowAfterDays: 2,  redAfterDays: 3  },
  leckortung:      { yellowAfterDays: 3,  redAfterDays: 5  },
  bericht:         { yellowAfterDays: 2,  redAfterDays: 4  },
  trocknung:       { yellowAfterDays: 15, redAfterDays: 30 },
  instandstellung: { yellowAfterDays: 5,  redAfterDays: 14 },
  rechnung:        { yellowAfterDays: 5,  redAfterDays: 10 },
});

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Returns days since a given ISO date string (0 = today, null = unknown).
 * @param {string|null|undefined} dateStr
 * @returns {number|null}
 */
export const getDaysSince = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now - d) / 86_400_000);
};

/**
 * Returns the number of days a project has been in its current status.
 * @param {import('./types.js').ProjectRecord} project
 * @returns {number|null}
 */
export const getDaysInStatus = (project) =>
  getDaysSince(project.statusStartedAt || project.date);

/**
 * Returns the human-readable label for a status string.
 * @param {string} status
 * @returns {string}
 */
export const getStatusLabel = (status) =>
  STATUS_LABELS[status] || status || '—';

/**
 * Calculates the priority color for a project based on STATUS_RULES.
 * @param {import('./types.js').ProjectRecord} project
 * @returns {{ priority: ProjectPriority, reason: string, urgency: number }}
 */
export const getProjectPriority = (project) => {
  if (project.status === 'Abgeschlossen' || project.status === 'rechnung') {
    return { priority: 'green', reason: 'Abgeschlossen', urgency: 0 };
  }

  const canonical = normaliseStatus(project.status);
  const rules = STATUS_RULES[canonical] || STATUS_RULES.eingang;
  const days = getDaysInStatus(project) ?? 0;

  // Extra-check: no contacts at all → always red after day 1
  const hasContacts = project.contacts && project.contacts.length > 0;
  if (!hasContacts && days >= 1) {
    return { priority: 'red', reason: 'Keine Kontakte erfasst', urgency: days };
  }

  // reportCreated = true → Bericht ist erledigt, kein "Bericht fehlt" mehr
  if (project.reportCreated && (canonical === 'leckortung' || canonical === 'bericht')) {
    return { priority: 'green', reason: 'Bericht erstellt', urgency: 0 };
  }

  // Trocknung: check measurement staleness
  if (canonical === 'trocknung') {
    const mDays = getDaysSinceLastMeasurement(project);
    if (mDays !== null && mDays > 10)
      return { priority: 'red', reason: `Feuchtekontrolle überfällig (${mDays} Tage)`, urgency: mDays };
    if (mDays !== null && mDays >= 7)
      return { priority: 'yellow', reason: `Feuchtekontrolle fällig (${mDays} Tage)`, urgency: mDays };
  }

  if (days >= rules.redAfterDays)
    return { priority: 'red', reason: buildReason(canonical, days, 'red'), urgency: days };

  if (days >= rules.yellowAfterDays)
    return { priority: 'yellow', reason: buildReason(canonical, days, 'yellow'), urgency: days };

  return { priority: 'green', reason: 'Alles im Zeitplan', urgency: days };
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Builds a human-readable reason string.
 * @param {string} canonical
 * @param {number} days
 * @param {'red'|'yellow'} severity
 * @returns {string}
 */
function buildReason(canonical, days, severity) {
  const dayStr = days === 1 ? '1 Tag' : `${days} Tagen`;
  const messages = {
    eingang:         `Eingang seit ${dayStr} ohne Kontakt`,
    kontakt:         `Kontaktphase seit ${dayStr} offen`,
    aufnahme:        `Aufnahme seit ${dayStr} offen`,
    leckortung:      severity === 'red'
                       ? `Bericht fehlt seit ${dayStr}`
                       : `Leckortung seit ${dayStr} – Termin prüfen`,
    bericht:         `Bericht seit ${dayStr} nicht erstellt`,
    trocknung:       `Trocknung seit ${dayStr} aktiv`,
    instandstellung: `Instandstellung seit ${dayStr} offen`,
    rechnung:        `Rechnung seit ${dayStr} nicht gestellt`,
  };
  return messages[canonical] || `${canonical} seit ${dayStr} offen`;
}

/**
 * Returns days since the last measurement across all rooms.
 * @param {import('./types.js').ProjectRecord} project
 * @returns {number|null}
 */
export function getDaysSinceLastMeasurement(project) {
  const rooms = [
    ...(project.rooms || []),
    ...(project.measurementRooms || []),
    ...(project.report_data?.rooms || []),
    ...(project.report_data?.measurementRooms || [])
  ];
  if (rooms.length === 0) return null;
  let latest = null;

  // Büro-Feld hat Vorrang wenn gesetzt (gespeichert via dryingCheckService)
  if (project.lastDryingCheckAt) {
    const d = new Date(project.lastDryingCheckAt);
    if (!isNaN(d)) latest = d;
  }

  // Zusätzlich aus Raum-Messdaten
  rooms.forEach(room => {
    if (!room) return;
    const mDate = room.measurementData?.globalSettings?.date || room.globalSettings?.date || room.date;
    if (mDate) {
      const d = new Date(mDate);
      if (!isNaN(d) && (!latest || d > latest)) latest = d;
    }
    (room.measurementHistory || []).forEach(h => {
      const hDate = h.date || h.datum || h.timestamp;
      if (hDate) {
        const d = new Date(hDate);
        if (!isNaN(d) && (!latest || d > latest)) latest = d;
      }
    });
  });

  return latest ? getDaysSince(latest) : null;
}

/**
 * Formats a day count as a human-readable string.
 * @param {number|null} days
 * @returns {string}
 */
export const formatDays = (days) => {
  if (days === null || days === undefined) return '—';
  if (days === 0) return 'Heute';
  if (days === 1) return '1 Tag';
  return `${days} Tage`;
};
