import test from 'node:test';
import assert from 'node:assert/strict';

const previousDryingStartDate = (report) => {
  if (report.dryingStarted) return report.dryingStarted;
  if (report.equipment && report.equipment.length > 0) {
    const dates = report.equipment.map(e => e.startDate).filter(d => d).sort();
    if (dates.length > 0) return dates[0];
  }
  return report.date;
};

const cases = [
  ['explicit drying start wins', { dryingStarted: '2026-03-02', date: '2026-01-01', equipment: [{ startDate: '2026-02-01' }] }, '2026-03-02'],
  ['earliest equipment date is selected', { date: '2026-01-01', equipment: [{ startDate: '2026-03-03' }, { startDate: '2026-02-02' }] }, '2026-02-02'],
  ['single equipment date is selected', { date: '2026-01-01', equipment: [{ startDate: '2026-04-04' }] }, '2026-04-04'],
  ['report date is used without equipment', { date: '2026-01-01' }, '2026-01-01'],
  ['report date is used for empty equipment', { date: '2026-01-01', equipment: [] }, '2026-01-01'],
  ['report date is used when equipment dates are missing', { date: '2026-01-01', equipment: [{ type: 'Trockner' }] }, '2026-01-01'],
  ['empty equipment dates are ignored', { date: '2026-01-01', equipment: [{ startDate: '' }, { startDate: '2026-05-05' }] }, '2026-05-05'],
  ['null equipment dates are ignored', { date: '2026-01-01', equipment: [{ startDate: null }, { startDate: '2026-06-06' }] }, '2026-06-06'],
  ['undefined equipment dates are ignored', { date: '2026-01-01', equipment: [{ startDate: undefined }] }, '2026-01-01'],
  ['undefined fallback remains undefined', { equipment: [] }, undefined],
];

for (const [name, report, expected] of cases) {
  test(name, () => {
    assert.strictEqual(previousDryingStartDate(report), expected);
  });
}

test('previousDryingStartDate does not mutate report or equipment', () => {
  const report = {
    date: '2026-01-01',
    equipment: [{ startDate: '2026-03-03' }, { startDate: '2026-02-02' }],
  };
  const before = structuredClone(report);
  previousDryingStartDate(report);
  assert.deepEqual(report, before);
});
