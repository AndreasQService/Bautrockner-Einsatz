import test from 'node:test';
import assert from 'node:assert/strict';

import { formatEquipmentProjectAddress } from '../src/utils/dashboardUtils.js';

const previousEquipmentProjectAddress = (report) => {
  const street = (typeof report.street === 'string' && report.street.trim())
    ? report.street
    : ((typeof report.address === 'string' && report.address.trim())
        ? report.address
        : ((typeof report.projectTitle === 'string' && report.projectTitle.trim()) ? report.projectTitle : 'Keine Strasse'));
  const details = `${[report.zip, report.city].filter(Boolean).join(' ')} ${report.projectNumber ? `(${report.projectNumber})` : ''}`.trim();
  return { street, details };
};

const cases = [
  ['complete realistic project', { street: 'Musterstrasse 12', zip: '8000', city: 'Zürich', projectNumber: 'Q-2026-001', projectTitle: 'Wasserschaden' }, { street: 'Musterstrasse 12', details: '8000 Zürich (Q-2026-001)' }],
  ['street and city', { street: 'Bahnhofstrasse 5', city: 'Bern' }, { street: 'Bahnhofstrasse 5', details: 'Bern' }],
  ['street only', { street: 'Seestrasse 8' }, { street: 'Seestrasse 8', details: '' }],
  ['city only', { city: 'Basel' }, { street: 'Keine Strasse', details: 'Basel' }],
  ['address with comma is ignored for street if missing', { address: 'Hauptstrasse 1, 9000 St. Gallen' }, { street: 'Hauptstrasse 1, 9000 St. Gallen', details: '' }],
  ['address without comma is fallback', { address: 'Hauptstrasse 1' }, { street: 'Hauptstrasse 1', details: '' }],
  ['project title is fallback', { projectTitle: 'Sanierung Geschäftshaus' }, { street: 'Sanierung Geschäftshaus', details: '' }],
  ['only project id is ignored', { id: 'project-123' }, { street: 'Keine Strasse', details: '' }],
  ['project number only keeps leading separator space', { projectNumber: 'Q-42' }, { street: 'Keine Strasse', details: '(Q-42)' }],
  ['empty strings', { street: '', zip: '', city: '', projectNumber: '' }, { street: 'Keine Strasse', details: '' }],
  ['null values', { street: null, zip: null, city: null, projectNumber: null }, { street: 'Keine Strasse', details: '' }],
  ['undefined values', { street: undefined, zip: undefined, city: undefined, projectNumber: undefined }, { street: 'Keine Strasse', details: '' }],
  ['missing properties', { projectTitle: 'Nicht verwendet' }, { street: 'Nicht verwendet', details: '' }],
  ['empty object', {}, { street: 'Keine Strasse', details: '' }],
  ['special characters', { street: 'Rue de l’Église 3–5', zip: '1201', city: 'Genève-Centre', projectNumber: 'Q/26-A' }, { street: 'Rue de l’Église 3–5', details: '1201 Genève-Centre (Q/26-A)' }],
  ['zip only', { zip: '6003' }, { street: 'Keine Strasse', details: '6003' }],
];

for (const [name, report, expected] of cases) {
  test(name, () => {
    assert.deepEqual(formatEquipmentProjectAddress(report), previousEquipmentProjectAddress(report));
    assert.deepEqual(previousEquipmentProjectAddress(report), expected);
  });
}

test('equipment project-address derivation does not mutate its input', () => {
  const report = { street: 'Musterstrasse 12', zip: '8000', city: 'Zürich', projectNumber: 'Q-2026-001' };
  const before = structuredClone(report);
  formatEquipmentProjectAddress(report);
  assert.deepEqual(report, before);
});
