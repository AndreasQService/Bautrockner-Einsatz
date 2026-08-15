import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  assertSafeJwtClaims,
  makeStorageState,
  validateSession,
  verifyAutomationBaseUrl,
} = require('./stress_suite/auth_helper.cjs');

const PROJECT_REF = 'aoxduqspiezzyqeqyzzl';
const guard = { supabaseUrl: `https://${PROJECT_REF}.supabase.co`, supabaseKey: 'anon-test-key' };
const expectedIdentity = { name: 'operator', email: 'operator@example.invalid' };

function jwt(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: `${guard.supabaseUrl}/auth/v1`,
    aud: 'authenticated',
    role: 'authenticated',
    sub: 'user-123',
    exp: now + 3600,
    ...overrides,
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.unit-test-signature`;
}

function successfulUserFetch() {
  return async () => ({ ok: true, json: async () => ({ id: 'user-123', email: expectedIdentity.email }) });
}

test('accepts only the exact HTTPS QTool test application origin', () => {
  assert.equal(verifyAutomationBaseUrl('https://qtool-test.vercel.app/'), 'https://qtool-test.vercel.app');
  for (const value of [
    'http://qtool-test.vercel.app',
    'https://qtool-test.vercel.app.evil.invalid',
    'https://qtool-test.vercel.app@evil.invalid',
    'https://qtool-test.vercel.app/project',
    'https://qtool-test.vercel.app/?access_token=secret',
    'https://qtool-test.vercel.app/#token=secret',
  ]) assert.throws(() => verifyAutomationBaseUrl(value), /exact approved HTTPS test application origin/);
});

test('rejects live, foreign, expired, anonymous and service-role JWT claims', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.doesNotThrow(() => assertSafeJwtClaims(jwt(), guard, now));
  assert.throws(() => assertSafeJwtClaims(jwt({ iss: 'https://yxdoecdqttgdncgbzyus.supabase.co/auth/v1' }), guard, now), /issuer/);
  assert.throws(() => assertSafeJwtClaims(jwt({ aud: 'anon' }), guard, now), /audience/);
  assert.throws(() => assertSafeJwtClaims(jwt({ role: 'service_role' }), guard, now), /service-role/);
  assert.throws(() => assertSafeJwtClaims(jwt({ exp: now + 30 }), guard, now), /expired or too close/);
  assert.throws(() => assertSafeJwtClaims(jwt({ exp: now + 3 * 60 * 60 }), guard, now), /Long-lived bearer/);
});

test('server validation cannot substitute another valid test user', async () => {
  await assert.rejects(
    validateSession(
      { access_token: jwt() },
      guard,
      async () => ({ ok: true, json: async () => ({ id: 'user-123', email: 'other@example.invalid' }) }),
      expectedIdentity,
    ),
    /identity mismatch/,
  );
});

test('validated user id must match JWT subject', async () => {
  await assert.rejects(
    validateSession(
      { access_token: jwt({ sub: 'attacker-user' }) },
      guard,
      successfulUserFetch(),
      expectedIdentity,
    ),
    /subject does not match/,
  );
});

test('browser state is bound to approved origin and contains no URL token', () => {
  const state = makeStorageState(
    { access_token: jwt(), refresh_token: 'refresh-secret', user: { id: 'user-123', email: expectedIdentity.email } },
    { projectRef: PROJECT_REF },
    'https://qtool-test.vercel.app/',
  );
  assert.equal(state.origins[0].origin, 'https://qtool-test.vercel.app');
  assert.equal(state.cookies.length, 0);
  assert.equal(JSON.stringify(state).includes('?access_token='), false);
});
