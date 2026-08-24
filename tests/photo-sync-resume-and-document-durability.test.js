import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker = fs.readFileSync(new URL('../src/lib/sync/supabaseSyncWorker.js', import.meta.url), 'utf8');
const form = fs.readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');

test('photo sync resumes Supabase-backed items until OneDrive is verified', () => {
  assert.doesNotMatch(worker, /p\.syncStatus !== 'uploaded_to_backend'/);
  assert.doesNotMatch(worker, /p\.syncStatus !== 'queued_for_remote'/);
  assert.match(worker, /const storagePath = photo\.supabasePath \|\|/);
  assert.match(worker, /uploadPhotoAndGetUrl\(odFolder, subFolder, oneDriveFile\)/);
});

test('existing project image metadata is repaired and verified', () => {
  assert.match(worker, /findIndex\(img => img\.id === photo\.id\)/);
  assert.match(worker, /syncStatus: 'remote_verified'/);
  assert.match(worker, /uploading: false/);
});

test('documents are durably stored before background sync', () => {
  const cloudBranch = form.slice(form.indexOf('if (isCloudFirstEnabled)'), form.indexOf('return;', form.indexOf('if (isCloudFirstEnabled)')));
  assert.match(cloudBranch, /savePhotoLocally\(imageId/);
  assert.doesNotMatch(cloudBranch, /isDoc\)[\s\S]*URL\.createObjectURL\(file\)/);
});

