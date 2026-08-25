import { hasSupplierInvoice } from './invoiceEvidence.js';

/**
 * filters.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Filter functions for the office project list.
 *
 * @typedef {import('./types.js').ProjectRowViewModel} ProjectRowViewModel
 * @typedef {import('./types.js').ProjectFilterKey} ProjectFilterKey
 */

/**
 * Filter definitions: key → predicate function.
 * Add new filters here without touching any component.
 * @type {Record<ProjectFilterKey, (row: ProjectRowViewModel) => boolean>}
 */
export const FILTER_PREDICATES = {
  all:         () => true,
  critical:    (r) => r.priority === 'red',
  delayed:     (r) => r.priority === 'yellow',
  reportOpen:  (r) => ['Leckortung', 'leckortung', 'Schadenaufnahme', 'aufnahme', 'bericht'].includes(r.currentStatus),
  invoiceOpen: (r) => {
    const raw = r._raw;
    const hasInvoice = hasSupplierInvoice(raw);
    return !hasInvoice && ['Instandsetzung', 'Instandstellung', 'instandstellung', 'rechnung'].includes(r.currentStatus);
  },
  unassigned:  (r) => r.isUnassigned,
  noActivity:  (r) => (r.daysInStatus ?? 0) >= 3 && r.openTasksCount > 0,
};

/**
 * Human-readable labels for each filter key.
 * @type {Record<ProjectFilterKey, string>}
 */
export const FILTER_LABELS = {
  all:         'Alle',
  critical:    'Kritisch',
  delayed:     'Verzögert',
  reportOpen:  'Bericht offen',
  invoiceOpen: 'Rechnung offen',
  unassigned:  'Nicht zugewiesen',
  noActivity:  'Keine Aktivität',
};

/**
 * Filters an array of rows by the given filter key.
 * Falls back to 'all' if key is unknown.
 * @param {ProjectRowViewModel[]} rows
 * @param {ProjectFilterKey | null} filterKey
 * @returns {ProjectRowViewModel[]}
 */
export const filterProjects = (rows, filterKey) => {
  if (!filterKey || filterKey === 'all') return rows;
  const predicate = FILTER_PREDICATES[filterKey];
  if (!predicate) return rows;
  return rows.filter(predicate);
};

/**
 * Optional: text search across key fields.
 * @param {ProjectRowViewModel[]} rows
 * @param {string} term
 * @returns {ProjectRowViewModel[]}
 */
export const searchProjects = (rows, term) => {
  if (!term || !term.trim()) return rows;
  const s = term.toLowerCase();
  return rows.filter(r =>
    r.displayName?.toLowerCase().includes(s) ||
    r.client?.toLowerCase().includes(s) ||
    r.projectNumber?.toLowerCase().includes(s) ||
    r.currentStatusLabel?.toLowerCase().includes(s) ||
    r.assignedTo?.toLowerCase().includes(s)
  );
};

/**
 * Calculates the count per filter key for badge display.
 * @param {ProjectRowViewModel[]} rows
 * @returns {Record<ProjectFilterKey, number>}
 */
export const calcFilterCounts = (rows) => {
  const result = {};
  for (const key of Object.keys(FILTER_PREDICATES)) {
    result[key] = rows.filter(FILTER_PREDICATES[key]).length;
  }
  return result;
};
