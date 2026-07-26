import test from 'node:test';
import assert from 'node:assert/strict';

import { formatStatusDuration } from '../src/utils/projectUtils.js';

const previousStatusDurationFormatting = (d) => d == null ? '' : d === 0 ? 'Heute' : d === 1 ? '1T' : `${d}T`;

const cases = [
  ['undefined fallback', undefined],
  ['null fallback', null],
  ['zero days', 0],
  ['one day', 1],
  ['multiple days', 2],
  ['large duration', 365],
  ['negative value', -1],
  ['empty string remains current T output', ''],
  ['numeric string remains current suffixed output', '1'],
  ['false remains current suffixed output', false],
];

for (const [name, input] of cases) {
  test(`formatStatusDuration: ${name}`, () => {
    assert.strictEqual(formatStatusDuration(input), previousStatusDurationFormatting(input));
  });
}
