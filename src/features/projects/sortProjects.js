/**
 * sortProjects.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Sorting logic for the office project list.
 *
 * Sort order:
 *   1. Red   (priority 1)  → highest urgency (most days) first
 *   2. Yellow (priority 2) → highest urgency first
 *   3. Green  (priority 3) → most recent first
 *
 * @typedef {import('./types.js').ProjectRowViewModel} ProjectRowViewModel
 */

const PRIORITY_ORDER = { red: 1, yellow: 2, green: 3 };

/**
 * Sorts an array of ProjectRowViewModels by priority then urgency.
 * Does NOT mutate the original array.
 * @param {ProjectRowViewModel[]} rows
 * @returns {ProjectRowViewModel[]}
 */
export const sortProjects = (rows) => {
  return [...rows].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 3;
    const pb = PRIORITY_ORDER[b.priority] ?? 3;

    // 1. Priority color
    if (pa !== pb) return pa - pb;

    // 2. Within same color: longest in status first (most urgent)
    const ua = a.urgency ?? 0;
    const ub = b.urgency ?? 0;
    if (ua !== ub) return ub - ua;

    // 3. Fallback: most recent project first
    const da = new Date(a._raw?.date || 0).getTime();
    const db = new Date(b._raw?.date || 0).getTime();
    return db - da;
  });
};
