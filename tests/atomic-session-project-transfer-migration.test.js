import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/20260824090000_allow_atomic_session_project_transfer.sql', import.meta.url),
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

test('keeps the RPC restricted to active authenticated users', () => {
  assert.match(migration, /ACTIVE_USER_PROFILE_REQUIRED/);
  assert.match(migration, /revoke all on function public\.acquire_project_lock[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.acquire_project_lock[\s\S]*to authenticated/);
});

