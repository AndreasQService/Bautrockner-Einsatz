import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/migrations/20260814000000_project_write_lock_enforcement.sql', import.meta.url), 'utf8');

test('storage migration replaces only its own case-files policies', () => {
  const block = sql.match(/DO \$storage_policies\$[\s\S]*?\$storage_policies\$;/)?.[0] || '';
  assert.doesNotMatch(block, /SELECT policyname FROM pg_policies/);
  assert.match(block, /DROP POLICY IF EXISTS qtool_owner_storage_insert/);
  assert.match(block, /bucket_id='case-files'/);
});

test('legacy privileged todo RPCs are explicitly revoked from browser roles', () => {
  assert.match(sql, /fn_complete_and_create_todo/);
  assert.match(sql, /fn_complete_todo_and_archive_project/);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/);
});

test('SYSTEM_SETTINGS has a separate admin-only mutation path', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.qtool_is_active_admin/);
  assert.match(sql, /id = 'SYSTEM_SETTINGS' AND public\.qtool_is_active_admin\(\)/);
  assert.doesNotMatch(sql, /id\s*<>\s*'SYSTEM_SETTINGS'.*qtool_has_project_write_lock/s);
});
