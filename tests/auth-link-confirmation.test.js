import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { confirmAuthLink, readAuthLinkConfirmation } from '../src/lib/authLinkConfirmation.js';

test('confirmation parser stays inactive for normal URLs', () => {
  assert.deepEqual(readAuthLinkConfirmation({ search: '?foo=bar' }), { active: false });
});

test('confirmation parser accepts invite and recovery token hashes', () => {
  assert.deepEqual(
    readAuthLinkConfirmation({ search: '?qtool_auth_confirm=1&type=invite&token_hash=abc123' }),
    { active: true, valid: true, type: 'invite', tokenHash: 'abc123' },
  );
  assert.equal(
    readAuthLinkConfirmation({ search: '?qtool_auth_confirm=1&type=recovery&token_hash=xyz' }).valid,
    true,
  );
});

test('confirmation parser rejects incomplete or malformed links', () => {
  assert.equal(readAuthLinkConfirmation({ search: '?qtool_auth_confirm=1&type=magiclink&token_hash=x' }).valid, false);
  assert.equal(readAuthLinkConfirmation({ search: '?qtool_auth_confirm=1&type=invite&token_hash=a%20b' }).valid, false);
});

test('confirmation verifies OTP and requires a real session', async () => {
  let received;
  const session = { access_token: 'jwt', user: { id: 'user-1' } };
  const supabase = { auth: { verifyOtp: async (payload) => { received = payload; return { data: { session }, error: null }; } } };
  const result = await confirmAuthLink(supabase, { valid: true, type: 'invite', tokenHash: 'token' });
  assert.deepEqual(received, { token_hash: 'token', type: 'invite' });
  assert.equal(result, session);
});

test('confirmation propagates verification errors and rejects missing sessions', async () => {
  await assert.rejects(
    confirmAuthLink({ auth: { verifyOtp: async () => ({ data: null, error: new Error('expired') }) } }, { valid: true, type: 'recovery', tokenHash: 'x' }),
    /expired/,
  );
  await assert.rejects(
    confirmAuthLink({ auth: { verifyOtp: async () => ({ data: {}, error: null }) } }, { valid: true, type: 'invite', tokenHash: 'x' }),
    /nicht sicher bestätigt/,
  );
});

test('UI redeems the token only from an explicit button click', () => {
  const source = fs.readFileSync(new URL('../src/components/AuthLinkConfirmationScreen.jsx', import.meta.url), 'utf8');
  assert.match(source, /onClick=\{handleConfirm\}/);
  assert.match(source, /confirmAuthLink\(supabase, request\)/);
  assert.doesNotMatch(source, /useEffect/);
});
