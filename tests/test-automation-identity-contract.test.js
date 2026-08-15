import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const identity = fs.readFileSync(new URL('../src/lib/testAutomationIdentity.js', import.meta.url), 'utf8');
const session = fs.readFileSync(new URL('../src/lib/testAutomationSession.js', import.meta.url), 'utf8');

test('operator mapping requires authoritative Supabase UUID plus email on exact test runtime', () => {
  assert.match(identity, /VITE_QTOOL_ENVIRONMENT/);
  assert.match(identity, /VITE_EXPECTED_SUPABASE_PROJECT_ID/);
  assert.match(identity, /VITE_AUTOMATION_ALLOWED_HOST/);
  assert.match(identity, /aoxduqspiezzyqeqyzzl/);
  assert.doesNotMatch(identity, /yxdoecdqttgdncgbzyus/);
  assert.match(identity, /supabase\.auth\.getUser\(\)/);
  assert.match(identity, /user\.id\).*expectedId/);
  assert.match(identity, /user\.email\).*expectedEmail/);
  assert.doesNotMatch(identity, /URLSearchParams|location\.search|location\.hash|service.role|service_role/i);
});

test('operator receives least-privilege non-admin QTool role', () => {
  assert.match(identity, /name: 'QTool E2E Operator'/);
  assert.match(identity, /role: 'user'/);
  assert.doesNotMatch(identity, /role: 'admin'/);
  assert.match(identity, /Object\.freeze/);
});

test('session installation resolves verified identity and global signout clears UI auth state', () => {
  assert.match(session, /resolveTestAutomationIdentity\(supabase\)/);
  assert.match(session, /catch \(identityError\)[\s\S]*revokeTestAutomationIdentity/);
  assert.match(session, /revokeTestAutomationSession/);
  assert.match(identity, /signOut\(\{ scope: 'global' \}\)/);
  assert.match(identity, /finally/);
  assert.match(identity, /qtool_current_user_/);
  assert.match(identity, /qtool_session_token_/);
  assert.match(identity, /Durable offline business records are intentionally retained/);
});
