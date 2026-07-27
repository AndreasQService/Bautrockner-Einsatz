import test from 'node:test';
import assert from 'node:assert/strict';

import { formatEquipmentTypeModel } from '../src/utils/dashboardUtils.js';

const previousEquipmentTypeModel = (equipment) =>
  [equipment.type, equipment.model]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(' - ');

const cases = [
  ['type and model', { type: 'Bautrockner', model: 'Trotec TTK 100' }, 'Bautrockner - Trotec TTK 100'],
  ['type only', { type: 'Bautrockner' }, 'Bautrockner'],
  ['model only', { model: 'Trotec TTK 100' }, 'Trotec TTK 100'],
  ['both empty', { type: '', model: '' }, ''],
  ['empty type with model', { type: '', model: 'KT 45' }, 'KT 45'],
  ['type with empty model', { type: 'Kondenstrockner', model: '' }, 'Kondenstrockner'],
  ['null values', { type: null, model: null }, ''],
  ['undefined values', { type: undefined, model: undefined }, ''],
  ['missing model field', { type: 'Gebläse' }, 'Gebläse'],
  ['empty object', {}, ''],
  ['duplicate type and model appears once', { type: 'Axialventilator', model: 'Axialventilator' }, 'Axialventilator'],
  ['realistic dehumidifier designation', { type: 'Luftentfeuchter', model: 'Q-Service LE 80' }, 'Luftentfeuchter - Q-Service LE 80'],
  ['special characters and hyphens', { type: 'Trockner-Pro', model: 'TTK 100-S / 230V' }, 'Trockner-Pro - TTK 100-S / 230V'],
  ['whitespace is preserved', { type: ' Bautrockner ', model: ' TTK 100 ' }, ' Bautrockner  -  TTK 100 '],
  ['truthy numbers are stringified', { type: 100, model: 200 }, '100 - 200'],
  ['zero is filtered while truthy model remains', { type: 0, model: 200 }, '200'],
];

for (const [name, equipment, expected] of cases) {
  test(name, () => {
    assert.strictEqual(formatEquipmentTypeModel(equipment), previousEquipmentTypeModel(equipment));
    assert.strictEqual(previousEquipmentTypeModel(equipment), expected);
  });
}

test('equipment type-model derivation does not mutate its input', () => {
  const equipment = { type: 'Bautrockner', model: 'Trotec TTK 100', deviceNumber: 'BT-42' };
  const before = structuredClone(equipment);
  formatEquipmentTypeModel(equipment);
  assert.deepEqual(equipment, before);
});
