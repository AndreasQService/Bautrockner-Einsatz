import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const supabaseVerifier = fs.readFileSync(new URL('../src/lib/verifyProjectSupabaseSync.js', import.meta.url), 'utf8');
const oneDriveVerifier = fs.readFileSync(new URL('../src/lib/verifyProjectOneDriveSync.js', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../src/lib/sync/supabaseSyncWorker.js', import.meta.url), 'utf8');
const control = fs.readFileSync(new URL('../src/components/ProjectSyncControlBox.jsx', import.meta.url), 'utf8');

test('cloud evidence identifies the exact missing candidate and repair reason', () => {
  assert.match(supabaseVerifier, /MISSING_SUPABASE_PATH/);
  assert.match(supabaseVerifier, /MISSING_SUPABASE_OBJECT/);
  assert.match(oneDriveVerifier, /MISSING_ONEDRIVE_LOCATOR/);
  assert.match(oneDriveVerifier, /STALE_ONEDRIVE_LOCATOR/);
  assert.match(oneDriveVerifier, /ONEDRIVE_GRAPH_TIMEOUT/);
  assert.match(control, /item\.id \|\| 'ohne ID'/);
  assert.match(control, /item\.storagePath \|\| 'ohne Pfad'/);
});

test('stalled photo releases the global worker and terminal local failures do not loop', () => {
  assert.match(worker, /PHOTO_SYNC_DEADLINE_MS = 20000/);
  assert.match(worker, /await withDeadline\(signal => syncOnePhoto\(photo, signal\), photo\)/);
  assert.match(worker, /controller\.abort\(\)/);
  assert.match(worker, /abortSignal\(signal\)/);
  assert.match(worker, /if \(p\.terminalFailure === true \|\| p\.syncStatus === 'terminal_error'\) return false/);
  assert.match(worker, /Datei beschädigt oder nicht lesbar – erneut auswählen/);
  assert.match(worker, /Lokales Original fehlt oder ist leer – Datei erneut auswählen/);
});

test('missing Supabase evidence schedules exact-photo repair and terminal photo has replacement action', () => {
  const form = fs.readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  assert.match(form, /scheduleSupabasePhotoRepairs/);
  assert.match(form, /replace-photo-\$\{recoveryKey\}/);
  assert.match(form, /await replacePhotoAtomically\(photo, replacement\)/);
  assert.match(form, /newPreview = await savePhotoLocally\(newId/);
  assert.ok(form.indexOf('newPreview = await savePhotoLocally(newId') < form.indexOf('if (oldPhoto.id) await deletePhotoLocally(oldPhoto.id)'));
  assert.match(form, /hasFreshSupabaseEvidence\(img\) && getCaseFileStoragePath\(img\)/);
});
