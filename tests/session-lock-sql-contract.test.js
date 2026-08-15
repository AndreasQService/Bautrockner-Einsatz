import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  new URL('../supabase/migrations/20260813000000_single_owner_project_lock.sql', import.meta.url),
  'utf8'
);

test('legacy duplicate owners are deterministically cleared before unique index', () => {
  const dedupe = sql.indexOf('WITH ranked_owners AS');
  const clearLosers = sql.indexOf('SET open_project_id = NULL', dedupe);
  const uniqueIndex = sql.indexOf('CREATE UNIQUE INDEX', clearLosers);
  assert.ok(dedupe >= 0 && clearLosers > dedupe && uniqueIndex > clearLosers);
  assert.match(sql, /PARTITION BY open_project_id/);
  assert.match(sql, /device[\s\S]*= 'iPad'\) DESC/);
  assert.match(sql, /last_seen DESC NULLS LAST/);
  assert.match(sql, /session_token ASC/);
});

test('acquire is serialised per project and iPad priority stays server-side', () => {
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(p_project_id, 0\)\)/);
  assert.match(sql, /v_request_is_ipad AND NOT v_owner_is_ipad/);
  assert.match(sql, /interval '20 minutes'/);
});

test('release requires the current project and session token', () => {
  const release = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.release_project_lock'));
  assert.match(release, /WHERE open_project_id = p_project_id[\s\S]*AND session_token = p_session_token/);
});
