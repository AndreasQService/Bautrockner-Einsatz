import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  new URL('../supabase/migrations/20260814000000_project_write_lock_enforcement.sql', import.meta.url),
  'utf8'
);

test('lease is bound to authenticated user plus unguessable request token', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS owner_user_id UUID/);
  assert.match(sql, /x-qtool-session-token/);
  assert.match(sql, /s\.session_token = public\.qtool_request_session_token\(\)/);
  assert.match(sql, /s\.owner_user_id = auth\.uid\(\)/);
  assert.doesNotMatch(sql, /last_seen\s*[<>]=?\s*now\(\)\s*-\s*interval\s*'20 minutes'/i);
  assert.match(sql, /valid offline owner never expires/i);
  assert.match(sql, /v_claimed_uid IS DISTINCT FROM v_request_uid/);
});

test('browser roles cannot exfiltrate session tokens and receive only redacted owner status', () => {
  assert.match(sql, /REVOKE ALL ON public\.project_sessions FROM PUBLIC, anon, authenticated/);
  const status = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.get_project_lock_status'), sql.indexOf('CREATE OR REPLACE FUNCTION public.acquire_project_lock'));
  assert.match(status, /RETURNS TABLE\([\s\S]*is_owner BOOLEAN/);
  assert.match(status, /p_session_token IS NOT NULL[\s\S]*s\.session_token = p_session_token/);
  assert.doesNotMatch(status.match(/RETURNS TABLE\([\s\S]*?\)/)?.[0] || '', /session_token/);
  assert.match(status, /GRANT EXECUTE ON FUNCTION public\.get_project_lock_status\(TEXT,TEXT\) TO authenticated/);
});

test('acquire remains single-owner atomic and release cannot be replayed by another session', () => {
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(p_project_id, 0\)\)/);
  assert.match(sql, /LIMIT 1 FOR UPDATE/);
  assert.match(sql, /SESSION_ALREADY_OWNS_PROJECT/);
  assert.doesNotMatch(sql, /OR \(v_request_is_ipad AND NOT v_owner_is_ipad\)/);
  assert.match(sql, /CREATE UNIQUE INDEX[\s\S]*project_sessions_unique_active_project|project_sessions_unique_active_project/);
  const release = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.release_project_lock'));
  assert.match(release, /open_project_id = p_project_id AND session_token = p_session_token[\s\S]*owner_user_id = auth\.uid\(\)/);
});

test('all known project business tables receive owner-only insert update delete policies', () => {
  for (const [table, column] of [
    ['damage_reports', 'id'],
    ['damage_report_rooms', 'report_id'],
    ['room_measurements', 'report_id'],
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
  ]) {
    assert.match(sql, new RegExp(`'${table}', '${column}'`), `${table} missing`);
  }
  assert.match(sql, /cmd IN \('INSERT', 'UPDATE', 'DELETE', 'ALL'\)/);
  assert.match(sql, /CREATE POLICY qtool_owner_insert/);
  assert.match(sql, /CREATE POLICY qtool_owner_update/);
  assert.match(sql, /CREATE POLICY qtool_owner_delete/);
});

test('project storage writes are owner-bound and foreign sessions retain reads', () => {
  assert.match(sql, /split_part\(p_name, '\/', 1\) = 'cases'/);
  assert.match(sql, /qtool_owner_storage_insert/);
  assert.match(sql, /qtool_owner_storage_update/);
  assert.match(sql, /qtool_owner_storage_delete/);
  assert.match(sql, /LIKE 'TESTRUN\\_%'/);
  assert.doesNotMatch(sql, /DROP POLICY[\s\S]+cmd = 'SELECT'/);
});

test('new project creation and first lease acquisition are one authenticated transaction', () => {
  const create = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.create_project_and_acquire_lock'));
  assert.match(create, /SECURITY DEFINER/);
  assert.match(create, /v_uid UUID := auth\.uid\(\)/);
  assert.match(create, /INSERT INTO public\.damage_reports/);
  assert.match(create, /INSERT INTO public\.project_sessions/);
  assert.match(create, /WHERE session_token = p_session_token FOR UPDATE/);
  assert.match(create, /SESSION_ALREADY_OWNS_PROJECT/);
  assert.match(create, /owner_user_id/);
  assert.match(create, /REVOKE ALL ON FUNCTION public\.create_project_and_acquire_lock/);
});

test('privileged bypass is service-only and audit data is mandatory', () => {
  assert.match(sql, /qtool_privileged_mutation_audit/);
  assert.match(sql, /reason TEXT NOT NULL/);
  assert.match(sql, /correlation_id TEXT NOT NULL/);
  assert.match(sql, /REVOKE ALL ON public\.qtool_privileged_mutation_audit FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE ON public\.damage_reports_audit FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE ON public\.audit_log FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /QTOOL_POLICY_PROJECT_COLUMN_MISSING/);
});

test('lock and creation responses never echo bearer session tokens', () => {
  const status = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.get_project_lock_status'), sql.indexOf('DROP FUNCTION IF EXISTS public.acquire_project_lock'));
  const create = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.create_project_and_acquire_lock'), sql.indexOf('-- Replace permissive authenticated mutation policies'));
  assert.doesNotMatch(status.match(/RETURNS TABLE\([\s\S]*?\)/)?.[0] || '', /session_token/);
  assert.doesNotMatch(create.match(/RETURN jsonb_build_object\([\s\S]*?\);/)?.[0] || '', /session_token/);
});
