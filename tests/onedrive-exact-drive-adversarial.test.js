import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../supabase/functions/onedrive-upload-worker/index.ts', import.meta.url), 'utf8');
const enqueue = readFileSync(new URL('../supabase/migrations/20260810010000_enqueue_project_image_upload.sql', import.meta.url), 'utf8');
const proofMigration = readFileSync(new URL('../supabase/migrations/20260814010000_exact_onedrive_drive_evidence.sql', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const oneDrive = readFileSync(new URL('../src/services/OneDriveService.js', import.meta.url), 'utf8');

test('worker verifies exact configured drive, exact bytes, eTag and SHA before remote_verified', () => {
  assert.match(worker, /\/drives\/\$\{encodeURIComponent\(DRIVE_ID\)\}\/items\/\$\{encodeURIComponent\(itemId\)\}/);
  assert.match(worker, /parentReference\?\.driveId/);
  assert.match(worker, /remoteSha256\.toLowerCase\(\) !== expectedSha256\.toLowerCase\(\)/);
  assert.match(worker, /const proof = await verifyItemBytes[\s\S]*storage_status:\s*'remote_verified',[\s\S]*\.\.\.proof/);
  const executable = worker.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(executable, /\/me\/drive/);
  assert.match(worker, /'@microsoft\.graph\.conflictBehavior': 'replace'/);
  assert.doesNotMatch(worker, /'@microsoft\.graph\.conflictBehavior': 'rename'/);
});

test('a changed blob/path clears every stale proof and requeues idempotently', () => {
  assert.match(enqueue, /sha256 IS DISTINCT FROM EXCLUDED\.sha256/);
  assert.match(enqueue, /THEN 'uploaded_to_backend'/);
  assert.match(proofMigration, /create or replace function public\.clear_stale_onedrive_proof/);
  for (const field of ['remote_drive_id', 'remote_item_id', 'remote_etag', 'remote_size_bytes', 'remote_sha256', 'verified_at']) {
    assert.match(proofMigration, new RegExp(`new\\.${field} := null`));
  }
});

test('legacy personal-drive project proof cannot be accepted as final evidence', () => {
  assert.match(oneDrive, /export async function uploadProjectJson[\s\S]*Direktes Projektdaten-JSON zu OneDrive ist deaktiviert/);
  assert.doesNotMatch(app, /uploadProjectJson/);
  assert.match(app, /deferredToCentralWorker: true/);
});
