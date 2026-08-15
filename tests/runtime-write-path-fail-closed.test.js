import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('legacy photo worker is disabled unless migration is explicitly authorized', () => {
  const worker = read('src/lib/sync/supabaseSyncWorker.js');
  assert.match(worker, /allowLegacyMigration\s*=\s*false/);
  assert.match(worker, /if \(allowLegacyMigration !== true\)/);
  assert.match(worker, /legacy_migration_not_explicit/);
  for (const caller of ['src/main.jsx', 'src/App.jsx', 'src/components/DamageForm.jsx']) {
    const source = read(caller);
    assert.doesNotMatch(source, /syncPendingToSupabase\s*\(\s*\{[^}]*allowLegacyMigration\s*:\s*true/);
  }
});

test('even an explicitly authorized legacy migration cannot invent OneDrive success', () => {
  const worker = read('src/lib/sync/supabaseSyncWorker.js');
  assert.match(worker, /storage_status === 'remote_verified'/);
  for (const field of ['remote_drive_id', 'remote_item_id', 'remote_etag', 'remote_size_bytes', 'remote_sha256', 'verified_at']) {
    assert.match(worker, new RegExp(`journalRow\\.${field}`));
  }
  assert.match(worker, /Number\(journalRow\.remote_size_bytes\) === Number\(compressedBlob\.size\)/);
  assert.match(worker, /journalRow\.remote_sha256[\s\S]*String\(sha256/);
  assert.match(worker, /OneDrive-Endbestätigung mit exaktem Drive-\/SHA-Nachweis steht noch aus/);
  assert.doesNotMatch(worker, /await updatePhotoSyncStatus\(photo\.id, \{\s*syncStatus: 'remote_verified'\s*}\)\.catch/s);
});

test('runtime Supabase client installs the fail-closed transport gate', () => {
  const client = read('src/supabaseClient.js');
  assert.match(client, /createSessionGuardedFetch/);
  assert.match(client, /global:\s*\{\s*fetch:\s*createSessionGuardedFetch\(/s);
});

test('active OneDrive writes are either centrally gated or legacy-fail-closed', () => {
  const central = read('src/lib/uploads/oneDriveApi.js');
  assert.match(central, /assertOneDriveWriteAllowed/);

  const legacy = read('src/services/OneDriveService.js');
  assert.match(legacy, /rejectDirectMutation/);
  for (const name of ['uploadPhoto', 'uploadPhotoFile', 'uploadPhotoAndGetUrl', 'uploadExcel', 'uploadMailText', 'uploadDocument']) {
    const body = legacy.match(new RegExp(`export async function ${name}\\b[\\s\\S]*?\\n}`))?.[0] || '';
    assert.match(body, /rejectDirectMutation/);
    assert.doesNotMatch(body, /fetch\(|method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
  }
});

test('outbox never confirms a mutation from request success without verified readback', () => {
  const worker = read('src/lib/offline/outboxWorker.js');
  assert.match(worker, /result\?\.verified !== true/);
  assert.match(worker, /UNVERIFIED_CLOUD_STATE/);
  assert.match(worker, /OFFLINE_STATES\.CLOUD_CONFIRMED/);
});

test('pending data pruning remains disabled and only confirmed transactions are eligible', () => {
  const store = read('src/lib/offline/transactionStore.js');
  assert.match(store, /enabled = false/);
  assert.match(store, /if \(enabled !== true\) return \[\]/);
  assert.match(store, /manifest\.status !== OFFLINE_STATES\.CLOUD_CONFIRMED/);
});
