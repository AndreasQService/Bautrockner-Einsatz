import test from 'node:test';
import assert from 'node:assert/strict';

import { formatTechnicianLocation } from '../src/utils/dashboardUtils.js';

const previousTechnicianLocation = (report) => {
  const streetPart = report.street?.trim();
  const cityPart = [report.zip, report.city].filter(p => p && p.trim()).join(' ');
  let loc = [streetPart, cityPart].filter(Boolean).join(', ');
  if (!loc || loc === ', , ' || loc === ',') {
    loc = report.address ? report.address.split(',')[0] : 'Keine Adresse';
  }
  return loc;
};

const cases = [
  ['full street, zip and city', { street: 'Musterweg 4', zip: '8000', city: 'Zürich' }],
  ['street only', { street: 'Musterweg 4' }],
  ['zip and city only', { zip: '8000', city: 'Zürich' }],
  ['city only', { city: 'Zürich' }],
  ['address fallback with comma', { address: 'Altweg 7, 3000 Bern' }],
  ['address fallback without comma', { address: 'Altweg 7' }],
  ['empty object fallback', {}],
  ['blank structured fields with address', { street: ' ', zip: '', city: '  ', address: 'Fallback 1, Basel' }],
  ['blank structured fields without address', { street: '', zip: '', city: '' }],
];

for (const [name, report] of cases) {
  test(name, () => {
    assert.strictEqual(formatTechnicianLocation(report), previousTechnicianLocation(report));
  });
}

test('formatTechnicianLocation does not mutate the report', () => {
  const report = { street: ' Weg 1 ', zip: '9000', city: 'St. Gallen', address: 'Alt' };
  const before = structuredClone(report);
  formatTechnicianLocation(report);
  assert.deepEqual(report, before);
});
