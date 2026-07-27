import test from 'node:test';
import assert from 'node:assert/strict';

const previousFormatEquipmentDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
};

const cases = [
  ['valid ISO date', '2026-07-15', '15.07.26'],
  ['date with local time', '2026-07-15T14:30:00', '15.07.26'],
  ['date without time', '2025-11-03', '03.11.25'],
  ['empty string fallback', '', '-'],
  ['null fallback', null, '-'],
  ['undefined fallback', undefined, '-'],
  ['invalid value is returned unchanged', 'kein-datum', 'kein-datum'],
  ['lower date boundary', '2000-01-01', '01.01.00'],
  ['realistic installation date', '2026-02-09', '09.02.26'],
  ['realistic removal date', '2026-12-31', '31.12.26'],
  ['leap day', '2024-02-29', '29.02.24'],
  ['UTC timestamp uses local calendar fields', '2026-06-20T12:00:00Z', '20.06.26'],
];

for (const [name, input, expected] of cases) {
  test(name, () => {
    assert.strictEqual(previousFormatEquipmentDate(input), expected);
  });
}

test('formatting does not mutate a Date-compatible object', () => {
  const input = new String('2026-07-15');
  const before = input.toString();
  previousFormatEquipmentDate(input);
  assert.strictEqual(input.toString(), before);
});
