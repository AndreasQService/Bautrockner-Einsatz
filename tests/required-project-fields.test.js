import test from 'node:test';
import assert from 'node:assert/strict';
import { getMissingRequiredProjectFields } from '../src/lib/safeProjectCreation.js';

test('requires project number, damage location, street, zip and city', () => {
  assert.deepEqual(getMissingRequiredProjectFields({}), [
    'Projekt-Nr.', 'Schadenort', 'Straße und Hausnummer', 'PLZ', 'Ort'
  ]);
});

test('accepts a project when the five approved business fields are filled', () => {
  assert.deepEqual(getMissingRequiredProjectFields({
    projectNumber: '20260001',
    locationDetails: 'Keller',
    street: 'Sonnenbergstrasse 1',
    zip: '8708',
    city: 'Männedorf',
  }), []);
});

test('does not require assignee, service type or status', () => {
  const missing = getMissingRequiredProjectFields({
    projectNumber: '20260001', locationDetails: 'Keller', street: 'Testweg 1', zip: '8000', city: 'Zürich'
  });
  assert.equal(missing.length, 0);
});
