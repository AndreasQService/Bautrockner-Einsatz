/**
 * normalizeReason.js
 * Entfernt redundante Zeitangaben aus reason-Strings,
 * da daysInStatus bereits separat angezeigt wird.
 *
 * Betrifft Muster wie:
 *   "Aufnahme seit 6 Tagen offen"   → "Aufnahme offen"
 *   "Bericht fehlt seit 3 Tagen"    → "Bericht fehlt"
 *   "Leckortung seit 5 Tagen offen" → "Leckortung offen"
 *   "Termin fehlt"                  → "Termin fehlt" (unverändert)
 */

// Regex entfernt " seit N Tag(en)" inkl. optionalem " offen" am Ende
const SEIT_PATTERN = /\s+seit\s+\d+\s+Tage?n?(\s+offen)?/gi;

/**
 * @param {string} reason
 * @returns {string}
 */
export const normalizeReason = (reason) => {
  if (!reason) return '';
  return reason.replace(SEIT_PATTERN, (match, hasOffen) => {
    // Wenn " offen" mitgegessen wurde, gib es zurück
    return hasOffen ? ' offen' : '';
  }).trim();
};
