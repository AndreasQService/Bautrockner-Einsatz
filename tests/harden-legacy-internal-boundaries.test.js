import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../supabase/migrations/20260821133000_harden_legacy_internal_boundaries.sql', import.meta.url), 'utf8');

test('internal legacy tables are protected by RLS and have no browser grants', () => {
  for (const table of ['reports', 'audit_log', 'project_sessions']) {
    assert.match(sql, new RegExp(`alter table if exists public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'i'));
  }
});

test('legacy security-definer entry points are unavailable to browser roles', () => {
  for (const fn of ['enqueue_onedrive_project_folder', 'enqueue_project_image_upload', 'get_project_image_upload_status']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\(`, 'i'));
  }
  assert.doesNotMatch(sql, /grant\s+execute[\s\S]+to\s+(?:anon|authenticated)/i);
});
