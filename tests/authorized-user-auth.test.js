import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveAuthorizedUser } from '../src/lib/authorizedUser.js';

const login = readFileSync(new URL('../src/components/LoginScreen.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const confirmed = (email, id = 'auth-1') => ({ id, email, email_confirmed_at: '2026-08-18T10:00:00Z', app_metadata: {} });

test('confirmed built-in identity is bound to the Supabase UUID', () => {
  const result = resolveAuthorizedUser(confirmed('Andreas.Strehler@bluewin.ch'));
  assert.equal(result?.role, 'admin');
  assert.equal(result?.supabaseUserId, 'auth-1');
});

test('unknown or unconfirmed identities are rejected', () => {
  assert.equal(resolveAuthorizedUser(confirmed('unknown@example.ch')), null);
  assert.equal(resolveAuthorizedUser({ id: 'x', email: 'andreas.strehler@bluewin.ch' }), null);
});

test('login requires an exact Supabase session and has no local password bypass', () => {
  assert.match(login, /signInWithPassword\(\{ email, password: trimmedPassword \}\)/);
  assert.match(login, /data\?\.session\?\.access_token/);
  assert.match(login, /data\?\.user\?\.id !== sessionUser\.id/);
  assert.doesNotMatch(login, /user\.password === trimmedPassword/);
  assert.doesNotMatch(login, /email:\s*['"]a\.strehler@q-service\.ch/);
});

test('App never restores authentication from local storage', () => {
  assert.match(app, /const \[currentUser, setCurrentUser\] = useState\(null\)/);
  assert.match(app, /resolveAuthorizedUser\(session\.user, readAuthorizedUsers\(\)\)/);
  assert.match(app, /if \(!authReady\)/);
  assert.doesNotMatch(app, /session\.user\.email === 'a\.strehler@q-service\.ch'/);
});
