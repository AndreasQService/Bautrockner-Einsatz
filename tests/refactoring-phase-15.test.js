import test from 'node:test';
import assert from 'node:assert/strict';

import { DASHBOARD_STATUS_COLORS } from '../src/config/dashboardConfig.js';

const expected = {
  Schadenaufnahme: 'bg-gray-100 text-gray-800',
  Leckortung: 'bg-blue-100 text-blue-800',
  Trocknung: 'bg-yellow-100 text-yellow-800',
  'Kontrolle*': 'bg-orange-100 text-orange-800',
  Instandsetzung: 'bg-green-100 text-green-800',
  Abgeschlossen: 'bg-gray-200 text-gray-600',
};

test('dashboard status colors preserve the complete mapping', () => {
  assert.deepEqual(DASHBOARD_STATUS_COLORS, expected);
});

test('dashboard status colors preserve key order', () => {
  assert.deepEqual(Object.keys(DASHBOARD_STATUS_COLORS), Object.keys(expected));
});

for (const [status, classes] of Object.entries(expected)) {
  test(`dashboard status color for ${status} remains unchanged`, () => {
    assert.equal(DASHBOARD_STATUS_COLORS[status], classes);
  });
}
