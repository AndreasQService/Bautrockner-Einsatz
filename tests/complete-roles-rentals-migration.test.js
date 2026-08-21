import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL('../supabase/migrations/20260821123000_complete_roles_and_rentals.sql', import.meta.url),
  'utf8'
);

test('all destructive project policies require administrator and project ownership', () => {
  assert.match(sql, /create or replace function public\.qtool_is_admin\(\)/i);
  assert.match(sql, /p\.role = 'admin'/i);
  assert.match(sql, /create policy qtool_owner_delete[\s\S]*qtool_is_admin\(\)[\s\S]*qtool_has_project_write_lock/i);
  assert.match(sql, /room_measurements[\s\S]*qtool_is_admin\(\)[\s\S]*qtool_room_has_project_write_lock/i);
  assert.match(sql, /devices for delete to authenticated[\s\S]*qtool_is_admin\(\)/i);
  assert.match(sql, /device_catalog for delete to authenticated[\s\S]*qtool_is_admin\(\)/i);
  assert.match(sql, /storage\.objects for delete to authenticated[\s\S]*qtool_is_admin\(\)/i);
});

test('rental inventory has its own active-number namespace', () => {
  assert.match(sql, /create table if not exists public\.rental_devices/i);
  const indexDefinition = sql.match(/create unique index if not exists rental_devices_active_number_uidx[\s\S]*?;/i)?.[0] || '';
  assert.match(indexDefinition, /on public\.rental_devices/i);
  assert.match(sql, /where end_date is null/i);
  assert.doesNotMatch(indexDefinition, /on public\.devices/i);
});

test('on-site device types are provisional catalog records using live catalog columns only', () => {
  assert.match(sql, /catalog_status in \('approved', 'provisional'\)/i);
  assert.match(sql, /insert into public\.device_catalog \(\s*geraetetyp, hersteller, modell, catalog_status, created_by\s*\)/i);
  assert.doesNotMatch(sql, /device_type, manufacturer, model_name, notes/i);
});

test('rental creation is authenticated, lock-bound and duplicate-safe', () => {
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /p\.is_active = true/i);
  assert.match(sql, /qtool_has_project_write_lock\(p_report_id\)/i);
  assert.match(sql, /pg_advisory_xact_lock[\s\S]*qtool-rental:/i);
  assert.match(sql, /RENTAL_NUMBER_ALREADY_ACTIVE/i);
  assert.match(sql, /revoke all on function public\.create_rental_device_assignment[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.create_rental_device_assignment[\s\S]*to authenticated/i);
});
