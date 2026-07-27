import test from 'node:test';
import assert from 'node:assert/strict';

import { formatTechnicianProjectReference } from '../src/utils/dashboardUtils.js';

const previousProjectReference = (report) => {
  const isId = (s) => typeof s === 'string' && (s.match(/-/g) || []).length >= 3 && !s.includes(' ');
  const parts = [report.projectNumber, report.projectTitle].filter(s => s && s.trim() && !isId(s));
  return parts.length > 0 ? parts.join(' - ') : '-';
};

const cases = [
  ['number and title', { projectNumber: 'Q-100', projectTitle: 'Musterprojekt' }],
  ['number only', { projectNumber: 'Q-100' }],
  ['title only', { projectTitle: 'Musterprojekt' }],
  ['empty object fallback', {}],
  ['empty strings fallback', { projectNumber: '', projectTitle: '' }],
  ['whitespace strings fallback', { projectNumber: ' ', projectTitle: '   ' }],
  ['id-like number excluded', { projectNumber: '1234-5678-9012-3456', projectTitle: 'Titel' }],
  ['id-like title excluded', { projectNumber: 'Q-100', projectTitle: '1234-5678-9012-3456' }],
  ['hyphenated title with spaces retained', { projectTitle: 'Projekt - mit - mehreren - Teilen' }],
];

for (const [name, report] of cases) {
  test(name, () => {
    assert.strictEqual(formatTechnicianProjectReference(report), previousProjectReference(report));
  });
}

test('formatTechnicianProjectReference does not mutate the report', () => {
  const report = { projectNumber: 'Q-100', projectTitle: 'Musterprojekt' };
  const before = structuredClone(report);
  formatTechnicianProjectReference(report);
  assert.deepEqual(report, before);
});
