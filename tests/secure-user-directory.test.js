import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const modal = fs.readFileSync(new URL('../src/components/UserManagementModal.jsx', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../src/services/AdminUserService.js', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../supabase/functions/admin-users/index.ts', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260821090000_create_secure_user_profiles.sql', import.meta.url), 'utf8');

test('user management exposes identity fields and the four required roles', () => {
  assert.match(modal, /field\('E-Mail'/);
  assert.match(modal, /field\('Anzeigename'/);
  assert.match(modal, /field\('Passwort'/);
  assert.match(modal, /<strong>E-Mail<\/strong><strong>Anzeigename<\/strong><strong>Passwort<\/strong><strong>Rolle<\/strong>/);
  for (const role of ['admin', 'technician', 'handwerker', 'user']) assert.match(modal, new RegExp(`value: '${role}'`));
});

test('stored passwords remain write-only while admins can inspect the new value before submitting', () => {
  assert.doesNotMatch(modal, /user\.password/);
  assert.match(modal, /Gespeicherte Passwörter sind niemals einsehbar/);
  assert.match(modal, /aria-label="Passwort nicht einsehbar">••••••••/);
  assert.match(modal, /showNewPassword/);
  assert.match(modal, /showEditPassword/);
  assert.match(modal, /Passwort verbergen/);
  assert.match(modal, /Passwort anzeigen/);
  assert.match(modal, /passwordVisible \? 'text' : type/);
  assert.match(service, /stripLegacyPasswords/);
  assert.doesNotMatch(app, /report_data:\s*\{\s*users: newUsers\s*\}/);
});

test('admin mutations stay server-side behind verified auth and admin profile', () => {
  assert.match(edge, /authClient\.auth\.getUser\(token\)/);
  assert.match(edge, /callerProfile\.role !== 'admin'/);
  assert.ok(
    edge.indexOf("callerProfile.role !== 'admin'") < edge.indexOf("action === 'list'"),
    'the admin boundary must also protect directory reads',
  );
  assert.match(edge, /service\.auth\.admin\.createUser/);
  assert.match(edge, /service\.auth\.admin\.updateUserById/);
  assert.match(edge, /service\.auth\.admin\.deleteUser/);
  assert.match(edge, /userId === authData\.user\.id/);
  assert.match(edge, /qtool_role:\s*role/);
  assert.match(edge, /qtool_display_name:\s*displayName/);
  assert.match(edge, /ALLOWED_ROLES\.has\(role\)/);
  assert.match(edge, /userId === authData\.user\.id && role !== 'admin'/);
  assert.doesNotMatch(service, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test('edge function CORS accepts the QTool session header used by the shared client', () => {
  assert.match(edge, /x-qtool-session-token/);
});

test('directory identities use the Supabase UUID for Todo assignment', () => {
  assert.match(service, /supabaseUserId: String\(user\.id\)/);
  assert.match(service, /auth_user_id: String\(user\.id\)/);
  assert.match(service, /authEmail:/);
});

test('user profiles are private, role constrained, and bootstrap only the known administrator', () => {
  assert.match(migration, /references auth\.users\(id\) on delete cascade/i);
  assert.match(migration, /role in \('admin', 'technician', 'handwerker', 'user'\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.user_profiles from public, anon, authenticated/i);
  assert.match(migration, /grant all on table public\.user_profiles to service_role/i);
  assert.match(migration, /lower\(coalesce\(u\.email, ''\)\) = 'a\.strehler@q-service\.ch'/i);
  assert.match(migration, /'Andreas Strehler',\s*'admin',\s*true/i);
  assert.doesNotMatch(migration, /else 'user'/i);
});

test('client surfaces the structured Edge Function error instead of hiding it', () => {
  assert.match(service, /error\.context/);
  assert.match(service, /response\.clone\(\)\.json\(\)/);
  assert.match(service, /payload\?\.error/);
});

test('directory publishing callback is stable and cannot retrigger the modal load loop', () => {
  assert.match(app, /const handleSetUsers = useCallback\(\(newUsers\) => \{/);
  assert.match(app, /setUsers\(stripLegacyPasswords\(newUsers\)\);\s*\}, \[\]\);/);
});
