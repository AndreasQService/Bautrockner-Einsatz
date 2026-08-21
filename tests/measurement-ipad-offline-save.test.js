import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const damageForm = fs.readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
const modal = fs.readFileSync(new URL('../src/components/MeasurementModal.jsx', import.meta.url), 'utf8');

test('both measurement render paths commit IndexedDB before starting cloud sync', () => {
  const localCommits = [...damageForm.matchAll(/await saveProjectDraftWithReadback\([\s\S]{0,500}?setFormData\(updatedFormData\);[\s\S]{0,500}?Promise\.resolve\(onSave/g)];
  assert.equal(localCommits.length, 2, 'desktop and technician measurement paths must share offline-first ordering');
});

test('measurement save never awaits Supabase Storage upload', () => {
  assert.equal(/cases\/\$\{formData\.id \|\| 'temp'\}\/protocols\//.test(damageForm), false);
  assert.match(damageForm, /Never block an iPad save on a Storage request/);
});

test('iPad canvas capture and blob generation have bounded deadlines', () => {
  assert.match(modal, /withDeadline\(html2canvas\(/);
  assert.match(modal, /isIpadOrMobile \? 8000 : 15000, 'Messprotokoll-Vorschau'/);
  assert.match(modal, /Messprotokoll-Dateierstellung hat das Zeitlimit überschritten/);
  assert.match(modal, /if \(settled\) return;/);
});

test('spinner is cleared on success and on terminal failure', () => {
  assert.match(modal, /setIsSaving\(false\);\s*onClose\(\)/);
  assert.match(modal, /alert\("Fehler beim Speichern der Messung\."\);\s*setIsSaving\(false\)/);
});
