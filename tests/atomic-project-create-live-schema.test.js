import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migrationPath = new URL(
  '../supabase/migrations/20260821053543_fix_atomic_project_create_live_schema.sql',
  import.meta.url,
)
const sql = fs.readFileSync(migrationPath, 'utf8')

test('atomic create uses only confirmed live damage_reports columns', () => {
  assert.match(
    sql,
    /\(id, project_title, client, address, status, assigned_to, report_data\)/,
  )
  assert.doesNotMatch(sql, /assignee_name/)
})

test('atomic create remains authenticated, serialized and fail-closed', () => {
  assert.match(sql, /v_uid uuid := auth\.uid\(\)/)
  assert.match(sql, /AUTHENTICATION_REQUIRED/)
  assert.match(sql, /qtool-session:/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /LOCK_OWNERSHIP_NOT_CONFIRMED/)
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function[\s\S]*to authenticated/)
})

test('project insert and lock acquisition remain in one transaction', () => {
  assert.match(sql, /^begin;/m)
  assert.match(sql, /insert into public\.damage_reports[\s\S]*public\.acquire_project_lock/)
  assert.match(sql, /commit;/)
})
