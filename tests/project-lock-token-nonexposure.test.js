import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hook = readFileSync(new URL('../src/hooks/useSessionLock.js', import.meta.url), 'utf8');
const create = readFileSync(new URL('../src/lib/offline/createLockedProject.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('browser lock status paths never read project_sessions or receive another device token', () => {
  for (const [name, source] of [['hook', hook], ['create', create]]) {
    assert.doesNotMatch(source, /\.from\(['"]project_sessions['"]\)/, `${name} reads secret lease rows`);
    assert.match(source, /get_project_lock_status/, `${name} does not use redacted status RPC`);
  }
  assert.doesNotMatch(app, /\.from\(['"]project_sessions['"]\)/);
  assert.match(app, /get_project_lock_status/);
});

test('same authenticated identity on a second client cannot infer ownership without its own request token', () => {
  assert.match(hook, /const amIOwner = Boolean\(ownerSession\?\.is_owner\)/);
  assert.doesNotMatch(hook, /ownerSession\.session_token/);
  assert.doesNotMatch(hook, /session_token !== myToken/);
});
