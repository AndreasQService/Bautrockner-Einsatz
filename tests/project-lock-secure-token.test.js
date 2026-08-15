import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('project owner token has no timestamp or Math.random fallback', () => {
  const factory = app.slice(
    app.indexOf('export function createSecureSessionToken'),
    app.indexOf('let mockDbProjectsRef')
  );
  assert.match(factory, /randomUUID/);
  assert.match(factory, /getRandomValues/);
  assert.match(factory, /new Uint8Array\(32\)/);
  assert.doesNotMatch(factory, /Math\.random|Date\.now/);
  assert.match(factory, /throw new Error/);
});

test('session initialization persists only the cryptographically generated token', () => {
  const start = app.indexOf('const [mySessionToken] =');
  const init = app.slice(start, start + 600);
  assert.match(init, /createSecureSessionToken\(\)/);
  assert.doesNotMatch(init, /Math\.random|Date\.now/);
});
