import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/20260819090000_restore_authenticated_project_lock_boundary.sql', import.meta.url), 'utf8');

test('all four RPCs require real auth.uid and fixed search paths', () => {
  for (const name of ['acquire_project_lock', 'get_project_lock_status', 'release_project_lock', 'create_project_and_acquire_lock']) {
    const start = sql.indexOf(`create or replace function public.${name}`);
    const end = sql.indexOf('$function$;', start) + '$function$;'.length;
    const body = sql.slice(start, end);
    assert.ok(start >= 0 && end > start, `${name} must exist`);
    assert.match(body, /auth\.uid\(\)/);
    assert.match(body, /AUTHENTICATION_REQUIRED/);
    assert.match(body, /security definer\s+set search_path = ''/);
    assert.doesNotMatch(body, /md5\s*\(|coalesce\s*\(\s*auth\.uid/);
  }
});

test('PUBLIC and anon cannot execute RPCs or access lock rows directly', () => {
  assert.match(sql, /revoke all on table public\.project_sessions from public, anon, authenticated/);
  for (const name of ['acquire_project_lock', 'get_project_lock_status', 'release_project_lock', 'create_project_and_acquire_lock']) {
    assert.match(sql, new RegExp(`'${name}'`));
  }
  assert.match(sql, /p\.oid::regprocedure[\s\S]*?revoke all on function %s from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant execute[^;]+to\s+(?:anon|public)/);
});

test('creation, acquire and release prove authenticated ownership fail closed', () => {
  assert.match(sql, /insert into public\.damage_reports[\s\S]*?select acquired into v_acquired/);
  assert.match(sql, /if v_acquired is distinct from true then[\s\S]*?raise exception 'LOCK_OWNERSHIP_NOT_CONFIRMED'/);
  assert.match(sql, /owner_user_id = v_uid/);
  assert.match(sql, /session_token = p_session_token and owner_user_id = v_uid/);
  assert.doesNotMatch(sql, /on conflict \(id\) do update/);
});

test('locks never expire or switch projects implicitly and require an active profile', () => {
  assert.doesNotMatch(sql, /interval\s+'20 minutes'/i);
  assert.match(sql, /SESSION_ALREADY_OWNS_PROJECT/);
  assert.equal((sql.match(/ACTIVE_USER_PROFILE_REQUIRED/g) || []).length, 4);
  assert.match(sql, /where p\.id = v_uid and p\.is_active is true/);
});

test('migration is transactional and creation safely replays only for the same owner session', () => {
  assert.match(sql, /^--[\s\S]*?\nbegin;/);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /open_project_id = p_project_id and session_token = p_session_token and owner_user_id = v_uid[\s\S]*?'already_existed', true/);
});

test('direct test bypasses are removed without touching audit RLS', () => {
  assert.match(sql, /drop policy if exists qtool_test_insert on public\.damage_reports/);
  assert.match(sql, /drop policy if exists qtool_test_update on public\.damage_reports/);
  assert.match(sql, /drop policy if exists qtool_test_delete on public\.damage_reports/);
  assert.doesNotMatch(sql, /qtool_privileged_mutation_audit/);
});

test('write-lock helpers bind a safe request token to active authenticated ownership', () => {
  assert.match(sql, /function public\.qtool_request_session_token\(\)[\s\S]*?security invoker[\s\S]*?set search_path = ''/);
  assert.match(sql, /exception when others then\s+return null/);
  assert.match(sql, /function public\.qtool_has_project_write_lock\(p_project_id text\)[\s\S]*?auth\.uid\(\) is not null[\s\S]*?p\.is_active is true[\s\S]*?s\.session_token = public\.qtool_request_session_token\(\)[\s\S]*?s\.owner_user_id = auth\.uid\(\)/);
  assert.doesNotMatch(sql, /grant execute on function public\.qtool_(?:request_session_token|has_project_write_lock)[^;]+to anon/);
});

test('legacy acquire OUT contract is revoked and dropped before replacement', () => {
  const dropIndex = sql.indexOf('drop function public.acquire_project_lock(text,text,text,text,text,text)');
  const createIndex = sql.indexOf('create or replace function public.acquire_project_lock(');

  assert.ok(dropIndex >= 0, 'legacy acquire signature must be dropped explicitly');
  assert.ok(createIndex > dropIndex, 'legacy acquire signature must be dropped before replacement');
  assert.match(
    sql.slice(0, createIndex),
    /revoke all on function public\.acquire_project_lock\(text,text,text,text,text,text\)\s+from public, anon, authenticated;/
  );
  assert.match(sql, /returns table\(acquired boolean, lock_owner text, locked_at timestamptz, last_seen_at timestamptz\)/);
  assert.doesNotMatch(sql, /returns table\(acquired boolean, lock_owner text, created_at/);
});

test('status RPC preserves both deployed parameter defaults', () => {
  assert.match(
    sql,
    /function public\.get_project_lock_status\(\s*p_project_id text default null,\s*p_session_token text default null\s*\)/
  );
  assert.match(sql, /if p_project_id is null then raise exception 'INVALID_PROJECT_ID'/);
});

test('all fourteen project tables restore authenticated owner-only writes', () => {
  const expected = [
    ['damage_reports', 'id'],
    ['damage_report_rooms', 'report_id'],
    ['room_measurements', 'room_id'],
    ['measurement_protocols', 'report_id'],
    ['rental_devices', 'report_id'],
    ['project_image_uploads', 'project_id'],
    ['project_tasks', 'project_id'],
    ['project_todos', 'project_id'],
    ['project_status_history', 'project_id'],
    ['case_documents', 'case_id'],
    ['case_extractions', 'case_id'],
    ['onedrive_project_folder_queue', 'project_id'],
    ['onedrive_sync_queue', 'project_id'],
    ['qtool_operations', 'report_id'],
  ];
  for (const [table, column] of expected) {
    if (table === 'room_measurements') {
      assert.match(sql, /function public\.qtool_room_has_project_write_lock\(p_room_id uuid\)/);
      assert.match(sql, /public\.qtool_room_has_project_write_lock\(room_id\)/);
    } else {
      assert.match(sql, new RegExp(`\\('${table}', '${column}'\\)`));
    }
  }
  assert.match(sql, /cmd in \('INSERT', 'UPDATE', 'DELETE', 'ALL'\)/);
  assert.match(sql, /revoke insert, update, delete, truncate, trigger on table public\.%I from public, anon, authenticated/);
  assert.match(sql, /create policy qtool_owner_insert[\s\S]*?for insert to authenticated with check \(public\.qtool_has_project_write_lock/);
  assert.match(sql, /create policy qtool_owner_update[\s\S]*?for update to authenticated using \(public\.qtool_has_project_write_lock/);
  assert.match(sql, /create policy qtool_owner_delete[\s\S]*?for delete to authenticated using \(public\.qtool_has_project_write_lock/);
  assert.match(sql, /if v_table = 'damage_reports'[\s\S]*?grant select, update, delete/);
  assert.doesNotMatch(sql, /grant select, insert, update, delete on table public\.damage_reports/);
  assert.doesNotMatch(sql, /for (?:insert|update|delete) to anon/);
});

test('acquire and create serialize one session before locking a project', () => {
  for (const name of ['acquire_project_lock', 'create_project_and_acquire_lock']) {
    const start = sql.indexOf(`create or replace function public.${name}`);
    const end = sql.indexOf('$function$;', start);
    const body = sql.slice(start, end);
    const sessionLock = body.indexOf("hashtextextended('qtool-session:' || p_session_token, 0)");
    const projectLock = body.indexOf('hashtextextended(p_project_id, 0)');
    assert.ok(sessionLock >= 0, `${name} must serialize the session token`);
    assert.ok(projectLock > sessionLock, `${name} must lock session before project`);
  }
});
