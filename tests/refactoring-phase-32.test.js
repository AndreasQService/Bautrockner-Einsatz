import test from 'node:test';
import assert from 'node:assert/strict';
import { getEquipmentStatus } from '../src/utils/dashboardUtils.js';

const previousEquipmentStatus = (equipment) => {
  const isAktiv = !equipment.endDate;
  const statusStyle = isAktiv ? {
    bg: 'rgba(16, 185, 129, 0.15)',
    color: '#10B981',
    border: '1px solid rgba(16, 185, 129, 0.25)',
  } : {
    bg: 'rgba(59, 130, 246, 0.15)',
    color: '#3B82F6',
    border: '1px solid rgba(59, 130, 246, 0.25)',
  };

  return {
    isAktiv,
    label: isAktiv ? 'Aktiv' : 'Deinstalliert',
    statusStyle,
  };
};

const activeStatus = {
  isAktiv: true,
  label: 'Aktiv',
  statusStyle: {
    bg: 'rgba(16, 185, 129, 0.15)',
    color: '#10B981',
    border: '1px solid rgba(16, 185, 129, 0.25)',
  },
};

const removedStatus = {
  isAktiv: false,
  label: 'Deinstalliert',
  statusStyle: {
    bg: 'rgba(59, 130, 246, 0.15)',
    color: '#3B82F6',
    border: '1px solid rgba(59, 130, 246, 0.25)',
  },
};

const cases = [
  ['active without end date', { startDate: '2026-07-01' }, activeStatus],
  ['removed with valid end date', { endDate: '2026-07-15' }, removedStatus],
  ['empty end date is active', { endDate: '' }, activeStatus],
  ['null end date is active', { endDate: null }, activeStatus],
  ['undefined end date is active', { endDate: undefined }, activeStatus],
  ['invalid truthy end date is removed', { endDate: 'kein-datum' }, removedStatus],
  ['complete realistic active equipment', { type: 'Bautrockner', model: 'TTK 100', startDate: '2026-07-01', endDate: null }, activeStatus],
  ['complete realistic removed equipment', { type: 'Bautrockner', model: 'TTK 100', startDate: '2026-07-01', endDate: '2026-07-15' }, removedStatus],
  ['missing properties are active', { type: 'Gebläse' }, activeStatus],
  ['empty object is active', {}, activeStatus],
  ['irrelevant fields do not affect status', { room: 'Keller', deviceNumber: 'BT-42' }, activeStatus],
  ['whitespace end date is removed', { endDate: ' ' }, removedStatus],
  ['numeric zero end date is active', { endDate: 0 }, activeStatus],
  ['truthy numeric end date is removed', { endDate: 1 }, removedStatus],
];

for (const [name, equipment, expected] of cases) {
  test(name, () => {
    assert.deepEqual(getEquipmentStatus(equipment), previousEquipmentStatus(equipment));
    assert.deepEqual(previousEquipmentStatus(equipment), expected);
  });
}

test('equipment status derivation does not mutate its input', () => {
  const equipment = { type: 'Bautrockner', endDate: '2026-07-15', deviceNumber: 'BT-42' };
  const before = structuredClone(equipment);
  getEquipmentStatus(equipment);
  assert.deepEqual(equipment, before);
});
