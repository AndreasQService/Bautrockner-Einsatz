import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const modal = fs.readFileSync(new URL('../src/components/UserManagementModal.jsx', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../src/services/AdminUserService.js', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../supabase/functions/admin-users/index.ts', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('user management exposes exactly the requested identity fields', () => {
  assert.match(modal, /field\('E-Mail'/);
  assert.match(modal, /field\('Anzeigename'/);
  assert.match(modal, /field\('Passwort'/);
  assert.match(modal, /<strong>E-Mail<\/strong><strong>Anzeigename<\/strong><strong>Passwort<\/strong>/);
});

test('passwords are write-only and never rendered or persisted', () => {
  assert.doesNotMatch(modal, /visiblePasswords|togglePasswordVisibility|user\.password/);
  assert.match(modal, /Passwörter sind niemals einsehbar/);
  assert.match(modal, /aria-label="Passwort nicht einsehbar">••••••••/);
  assert.match(service, /stripLegacyPasswords/);
  assert.doesNotMatch(app, /report_data:\s*\{\s*users: newUsers\s*\}/);
});

test('admin mutations stay server-side behind verified auth and admin profile', () => {
  assert.match(edge, /authClient\.auth\.getUser\(token\)/);
  assert.match(edge, /callerProfile\.role !== 'admin'/);
  assert.match(edge, /service\.auth\.admin\.createUser/);
  assert.match(edge, /service\.auth\.admin\.updateUserById/);
  assert.match(edge, /service\.auth\.admin\.deleteUser/);
  assert.match(edge, /userId === authData\.user\.id/);
  assert.match(edge, /qtool_role:\s*'technician'/);
  assert.match(edge, /qtool_display_name:\s*displayName/);
  assert.doesNotMatch(service, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test('directory identities use the Supabase UUID for Todo assignment', () => {
  assert.match(service, /supabaseUserId: String\(user\.id\)/);
  assert.match(service, /auth_user_id: String\(user\.id\)/);
  assert.match(service, /authEmail:/);
});
