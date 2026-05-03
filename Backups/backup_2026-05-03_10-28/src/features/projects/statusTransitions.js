/**
 * statusTransitions.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Defines which status transitions are ALLOWED for office users.
 *
 * WHY SEPARATE FROM statusRules.js:
 *   Rules define timing thresholds.
 *   Transitions define valid state machine paths.
 *   These are distinct concerns.
 *
 * DESIGN RULE:
 *   Status transitions are controlled exclusively by the office.
 *   Technician data (measurements, equipment) may INFORM status,
 *   but NEVER automatically change status.
 *
 * @typedef {import('./types.js').ProjectStatus} ProjectStatus
 */

import { normaliseStatus } from './statusRules.js';

/** Human-readable labels for the transition dropdown. */
export const STATUS_TRANSITION_LABELS = {
  eingang:         'Eingang',
  kontakt:         'Kontakt aufgenommen',
  aufnahme:        'Schadenaufnahme läuft',
  leckortung:      'Leckortung läuft',
  bericht:         'Bericht in Arbeit',
  trocknung:       'Trocknung läuft',
  instandstellung: 'Instandstellung läuft',
  rechnung:        'Abschluss / Rechnung',
};

/**
 * Allowed forward transitions per status.
 * Backward transitions are generally not allowed to prevent data loss.
 * Forward-skip (e.g. aufnahme → trocknung) is possible where technically valid.
 *
 * @type {Record<ProjectStatus, ProjectStatus[]>}
 */
export const ALLOWED_TRANSITIONS = {
  eingang:         ['kontakt'],
  kontakt:         ['aufnahme'],
  aufnahme:        ['leckortung', 'bericht'],        // bericht possible if no leak found
  leckortung:      ['bericht', 'trocknung'],          // bericht needed before trocknung
  bericht:         ['trocknung', 'instandstellung'], // skip trocknung if not needed
  trocknung:       ['instandstellung'],
  instandstellung: ['rechnung'],
  rechnung:        [],                               // terminal state
};

/**
 * Same table but for legacy raw status strings stored in the database.
 * Maps to canonical IDs first, then looks up ALLOWED_TRANSITIONS.
 */
const LEGACY_TO_CANONICAL = {
  'Schadenaufnahme': 'aufnahme',
  'Leckortung':      'leckortung',
  'Trocknung':       'trocknung',
  'Instandsetzung':  'instandstellung',
  'Instandstellung': 'instandstellung',
  'Abgeschlossen':   'rechnung',
};

/**
 * Resolves a raw status string to a canonical ProjectStatus.
 * @param {string} raw
 * @returns {ProjectStatus}
 */
export const toCanonical = (raw) => LEGACY_TO_CANONICAL[raw] || normaliseStatus(raw);

/**
 * Returns true if the transition from currentStatus → nextStatus is allowed.
 * @param {string} currentRaw  - Raw status string (legacy or canonical)
 * @param {ProjectStatus} nextStatus
 * @returns {boolean}
 */
export const canTransitionTo = (currentRaw, nextStatus) => {
  const canonical = toCanonical(currentRaw);
  const allowed = ALLOWED_TRANSITIONS[canonical] || [];
  return allowed.includes(nextStatus);
};

/**
 * Returns all valid next statuses from the given current status.
 * @param {string} currentRaw
 * @returns {ProjectStatus[]}
 */
export const getAllowedNextStatuses = (currentRaw) => {
  const canonical = toCanonical(currentRaw);
  return ALLOWED_TRANSITIONS[canonical] || [];
};

/**
 * Returns the display label for a status.
 * @param {ProjectStatus} status
 * @returns {string}
 */
export const getTransitionLabel = (status) =>
  STATUS_TRANSITION_LABELS[status] || status;

/**
 * Returns true if a project is at the terminal state (rechnung / Abgeschlossen).
 * @param {string} rawStatus
 * @returns {boolean}
 */
export const isTerminalStatus = (rawStatus) => {
  const canonical = toCanonical(rawStatus);
  return canonical === 'rechnung' || rawStatus === 'Abgeschlossen';
};
