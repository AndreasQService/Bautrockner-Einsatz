import test from 'node:test';
import assert from 'node:assert/strict';

const previousGetDaysRunning = (startDateStr, endDateStr) => {
  if (!startDateStr) return '-';
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return '-';
  const end = endDateStr ? new Date(endDateStr) : new Date();
  if (isNaN(end.getTime())) return '-';
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = end - start;
  return `${Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))} d`;
};

const completedCases = [
  ['same start and end date', '2026-07-15', '2026-07-15', '0 d'],
  ['exactly one day', '2026-07-15', '2026-07-16', '1 d'],
  ['multiple days', '2026-07-01', '2026-07-10', '9 d'],
  ['month boundary', '2026-01-31', '2026-02-02', '2 d'],
  ['year boundary', '2025-12-31', '2026-01-02', '2 d'],
  ['leap-year boundary', '2024-02-28', '2024-03-01', '2 d'],
  ['timestamps with times', '2026-07-15T23:45:00', '2026-07-16T00:15:00', '1 d'],
  ['different times on same calendar day', '2026-07-15T00:01:00', '2026-07-15T23:59:00', '0 d'],
  ['end before start is clamped', '2026-07-16', '2026-07-15', '0 d'],
  ['invalid start date', 'kein-startdatum', '2026-07-15', '-'],
  ['invalid end date', '2026-07-15', 'kein-enddatum', '-'],
  ['empty start date', '', '2026-07-15', '-'],
  ['null start date', null, '2026-07-15', '-'],
  ['undefined start date', undefined, '2026-07-15', '-'],
];

for (const [name, startDate, endDate, expected] of completedCases) {
  test(name, () => {
    assert.strictEqual(previousGetDaysRunning(startDate, endDate), expected);
  });
}

test('completed runtime calculation does not mutate Date inputs', () => {
  const startDate = new Date('2026-07-15T14:30:00');
  const endDate = new Date('2026-07-18T09:15:00');
  const startBefore = startDate.getTime();
  const endBefore = endDate.getTime();

  assert.strictEqual(previousGetDaysRunning(startDate, endDate), '3 d');
  assert.strictEqual(startDate.getTime(), startBefore);
  assert.strictEqual(endDate.getTime(), endBefore);
});
