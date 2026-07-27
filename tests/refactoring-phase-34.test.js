import test from 'node:test';
import assert from 'node:assert/strict';

const previousActiveEquipmentRuntime = (startDateStr, referenceNow) => {
  if (!startDateStr) return '-';
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return '-';
  const end = new Date(referenceNow);
  if (isNaN(end.getTime())) return '-';
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = end - start;
  return `${Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))} d`;
};

const referenceNow = '2026-07-27T15:30:00+02:00';

const cases = [
  ['same calendar day', '2026-07-27', referenceNow, '0 d'],
  ['exactly one day', '2026-07-26', referenceNow, '1 d'],
  ['multiple days', '2026-07-20', referenceNow, '7 d'],
  ['month boundary', '2026-06-30', '2026-07-02T12:00:00+02:00', '2 d'],
  ['year boundary', '2025-12-31', '2026-01-02T12:00:00+01:00', '2 d'],
  ['leap-year boundary', '2024-02-28', '2024-03-01T12:00:00+01:00', '2 d'],
  ['spring DST boundary in Europe/Zurich', '2026-03-29T12:00:00+02:00', '2026-03-30T12:00:00+02:00', '1 d'],
  ['autumn DST boundary in Europe/Zurich rounds 25 hours upward', '2026-10-25T12:00:00+01:00', '2026-10-26T12:00:00+01:00', '2 d'],
  ['start time is normalized to local midnight', '2026-07-26T23:59:59+02:00', referenceNow, '1 d'],
  ['future start date is clamped', '2026-07-30', referenceNow, '0 d'],
  ['invalid start date', 'kein-datum', referenceNow, '-'],
  ['empty start date', '', referenceNow, '-'],
  ['null start date', null, referenceNow, '-'],
  ['undefined start date', undefined, referenceNow, '-'],
  ['realistic active equipment start date', '2026-07-01T08:15:00+02:00', referenceNow, '26 d'],
];

for (const [name, startDate, now, expected] of cases) {
  test(name, () => {
    assert.equal(previousActiveEquipmentRuntime(startDate, now), expected);
  });
}

test('active runtime calculation does not mutate Date inputs', () => {
  const startDate = new Date('2026-07-01T08:15:00+02:00');
  const now = new Date(referenceNow);
  const startBefore = startDate.getTime();
  const nowBefore = now.getTime();

  previousActiveEquipmentRuntime(startDate, now);

  assert.equal(startDate.getTime(), startBefore);
  assert.equal(now.getTime(), nowBefore);
});
