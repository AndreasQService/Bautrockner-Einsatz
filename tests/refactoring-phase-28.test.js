import test from 'node:test';
import assert from 'node:assert/strict';

const previousEquipmentLocation = (equipment) => {
  if (!equipment.room) return '';
  return `${equipment.apartment ? `${equipment.apartment} - ` : ''}${equipment.room}`;
};

const cases = [
  ['complete realistic location', { apartment: 'Wohnung 2', room: 'Badezimmer' }, 'Wohnung 2 - Badezimmer'],
  ['room only', { room: 'Keller' }, 'Keller'],
  ['location only without room yields empty label', { apartment: 'Wohnung 2' }, ''],
  ['both values present', { apartment: 'EG', room: 'Küche' }, 'EG - Küche'],
  ['both empty', { apartment: '', room: '' }, ''],
  ['empty location with room', { apartment: '', room: 'Schlafzimmer' }, 'Schlafzimmer'],
  ['room empty with location', { apartment: '1. OG', room: '' }, ''],
  ['null values', { apartment: null, room: null }, ''],
  ['undefined values', { apartment: undefined, room: undefined }, ''],
  ['missing location property', { room: 'Technikraum' }, 'Technikraum'],
  ['missing room property', { apartment: 'UG' }, ''],
  ['empty object', {}, ''],
  ['identical location and room are both retained', { apartment: 'Bad', room: 'Bad' }, 'Bad - Bad'],
  ['special characters', { apartment: 'Haus A / 2. OG', room: 'WC-Dusche (Nord)' }, 'Haus A / 2. OG - WC-Dusche (Nord)'],
  ['realistic commercial location', { apartment: 'Gewerbeeinheit 3', room: 'Serverraum' }, 'Gewerbeeinheit 3 - Serverraum'],
  ['whitespace remains unchanged', { apartment: ' EG ', room: ' Bad ' }, ' EG  -  Bad '],
];

for (const [name, equipment, expected] of cases) {
  test(name, () => {
    assert.strictEqual(previousEquipmentLocation(equipment), expected);
  });
}

test('equipment location derivation does not mutate its input', () => {
  const equipment = { apartment: 'Wohnung 2', room: 'Badezimmer', deviceNumber: 'BT-42' };
  const before = structuredClone(equipment);
  previousEquipmentLocation(equipment);
  assert.deepEqual(equipment, before);
});
