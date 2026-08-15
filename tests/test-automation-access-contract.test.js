import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync(new URL('../api/test-automation-session.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/lib/testAutomationSession.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260814030000_test_automation_access_audit.sql', import.meta.url), 'utf8');

test('automation exchange is POST-only, no-store, HMAC signed and replay protected', () => {
  assert.match(api, /req\.method !== 'POST'/);
  assert.match(api, /Cache-Control', 'no-store/);
  assert.match(api, /createHmac\('sha256'/);
  assert.match(api, /timingSafeEqual/);
  assert.match(api, /claimNonce/);
  assert.match(api, /nonce_replayed/);
  assert.doesNotMatch(api, /req\.query/);
});

test('automation exchange is bound to exact test project, host and optional git ref', () => {
  assert.match(api, /projectName !== 'qtool-test'/);
  assert.match(api, /getRequestHost\(req\) !== allowedHost/);
  assert.match(api, /actualRef !== expectedRef/);
  assert.match(api, /aoxduqspiezzyqeqyzzl/);
  assert.match(api, /supabaseUrl\.includes\(LIVE_SUPABASE_ID\)/);
  assert.match(api, /QTOOL_AUTOMATION_USER_ID/);
  assert.match(api, /data\?\.user\?\.id/);
});

test('browser proof is sent only in POST body/header and session is read back', () => {
  assert.match(client, /fetch\('\/api\/test-automation-session'/);
  assert.match(client, /method: 'POST'/);
  assert.match(client, /x-qtool-automation-signature/);
  assert.match(client, /supabase\.auth\.setSession/);
  assert.match(client, /data\.session\.user\.id !== result\.user\.id/);
});

test('audit tables are test-ref guarded and inaccessible to browser roles', () => {
  assert.match(migration, /restricted to aoxduqspiezzyqeqyzzl/);
  assert.match(migration, /nonce text primary key/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all .* from anon, authenticated/g);
  assert.doesNotMatch(migration, /create policy/i);
});
