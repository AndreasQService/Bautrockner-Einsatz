import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const form = fs.readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');

test('project save state is a non-animated red or green evidence dot', () => {
  assert.match(form, /const saveConfirmed = saveState === 'saved' && !isSaving && !isSyncPending/);
  assert.match(form, /backgroundColor: saveConfirmed \? '#10B981' : '#EF4444'/);
  assert.match(form, /saveConfirmed \? 'Gespeichert' : 'Speicherung ausstehend'/);
  assert.match(form, /role="status"/);
});

test('autosave success and failure update the evidence state', () => {
  assert.match(form, /const \[saveState, setSaveState\] = useState\('pending'\)/);
  assert.match(form, /if \(savedReport\?\.success === true\)/);
  assert.match(form, /setLastSaved\(new Date\(\)\);\s*setSaveState\('saved'\)/);
  assert.match(form, /Auto-save failed:[\s\S]{0,120}setSaveState\('pending'\)/);
});
