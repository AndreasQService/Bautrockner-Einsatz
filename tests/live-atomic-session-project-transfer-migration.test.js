import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/20260824120000_preserve_live_legacy_session_claim_on_transfer.sql', import.meta.url),
  'utf8'
);

test('serializes a session and atomically transfers its single project row', () => {
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*qtool-session:/);
  assert.match(migration, /where session_token = p_session_token for update/);
  assert.doesNotMatch(migration, /SESSION_ALREADY_OWNS_PROJECT/);
  assert.match(migration, /on conflict \(session_token\) do update set[\s\S]*open_project_id = excluded\.open_project_id/);
});

test('keeps ownership and foreign-project protections in place', () => {
  assert.match(migration, /SESSION_OWNER_MISMATCH/);
  assert.match(migration, /v_owner\.session_token <> p_session_token or v_owner\.owner_user_id <> v_uid/);
  assert.match(migration, /return query select false/);
  assert.match(migration, /LOCK_OWNERSHIP_NOT_CONFIRMED/);
});

test('keeps authentication, legacy released-session claiming and RPC grants', () => {
  assert.match(migration, /AUTHENTICATION_REQUIRED/);
  assert.match(migration, /v_request_session\.owner_user_id is null[\s\S]*v_request_session\.open_project_id is null/);
  assert.match(migration, /owner_user_id = v_uid/);
  assert.match(migration, /revoke all on function public\.acquire_project_lock[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.acquire_project_lock[\s\S]*to authenticated/);
});

