import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const sql = fs.readFileSync(
  new URL('../supabase/migrations/20260821053819_claim_released_legacy_session_owner.sql', import.meta.url),
  'utf8',
)

test('only a completely released ownerless legacy session may be claimed', () => {
  assert.match(sql, /owner_user_id is null[\s\S]*open_project_id is null/)
  assert.match(sql, /where session_token = p_session_token[\s\S]*owner_user_id is null[\s\S]*open_project_id is null/)
  assert.doesNotMatch(sql, /last_seen\s*</)
  assert.doesNotMatch(sql, /interval\s*'/)
})

test('foreign and active sessions remain fail closed', () => {
  assert.match(sql, /owner_user_id is distinct from v_uid[\s\S]*SESSION_OWNER_MISMATCH/)
  assert.match(sql, /SESSION_ALREADY_OWNS_PROJECT/)
  assert.match(sql, /LOCK_OWNERSHIP_NOT_CONFIRMED/)
})

test('RPC remains authenticated-only and transactional', () => {
  assert.match(sql, /^begin;/m)
  assert.match(sql, /v_uid uuid := auth\.uid\(\)/)
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function[\s\S]*to authenticated/)
  assert.match(sql, /commit;/)
})
