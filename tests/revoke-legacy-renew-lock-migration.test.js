import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL('../supabase/migrations/20260819110500_revoke_legacy_renew_project_lock.sql', import.meta.url),
  'utf8'
);

test('legacy renew lock RPC is revoked transactionally for every browser role', () => {
  assert.match(sql, /^begin;/);
  assert.match(
    sql,
    /revoke all on function public\.renew_project_lock\(text,text\)\s+from public, anon, authenticated;/
  );
  assert.match(sql, /notify pgrst, 'reload schema';/);
  assert.match(sql, /commit;\s*$/);
  assert.doesNotMatch(sql, /drop function|grant execute/i);
});
