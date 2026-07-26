import test from 'node:test';
import assert from 'node:assert/strict';

import { formatNextAction } from '../src/utils/projectUtils.js';

const previousNextActionFormatting = (nextAction) => (nextAction || '').length > 48
  ? nextAction.slice(0, 46) + '…'
  : (nextAction || '');

const comparisonCases = [
  ['typical text', 'Termin mit Eigentümer bestätigen'],
  ['undefined fallback', undefined],
  ['null fallback', null],
  ['empty string', ''],
  ['whitespace remains unchanged', '   '],
  ['exactly 48 characters', 'a'.repeat(48)],
  ['49-character boundary', 'b'.repeat(49)],
  ['long text', 'Trocknungsgeräte kontrollieren und Messwerte vollständig dokumentieren'],
  ['short unicode text', 'Nächste Prüfung – Gerät 2'],
];

for (const [name, input] of comparisonCases) {
  test(`formatNextAction: ${name}`, () => {
    assert.strictEqual(formatNextAction(input), previousNextActionFormatting(input));
  });
}

test('formatNextAction: truncates after 46 characters and appends the existing ellipsis', () => {
  const input = '0123456789012345678901234567890123456789012345678';
  assert.equal(formatNextAction(input), `${input.slice(0, 46)}…`);
});

test('formatNextAction: does not mutate its input', () => {
  const input = new String('Unveränderte Eingabe');
  const before = input.toString();

  assert.strictEqual(formatNextAction(input), input);
  assert.equal(input.toString(), before);
});
