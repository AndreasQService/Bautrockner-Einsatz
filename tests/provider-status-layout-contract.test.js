import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('provider status remains first and visible in the header action strip', () => {
  assert.match(app, /<nav className="header-actions">/);
  assert.match(app, /id="provider-status-group" className="provider-status-group"/);
  assert.match(css, /\.header-actions\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.provider-status-group\s*\{[^}]*flex:\s*0 0 auto[^}]*order:\s*-1/s);
});

test('both provider badges remain real fail-closed status controls', () => {
  assert.match(app, /id="supabase-status-badge"/);
  assert.match(app, /supabaseStatus\?\.ok === true/);
  assert.match(app, /id="onedrive-connect-button"/);
  assert.match(app, /oneDriveServiceStatus(?:\?\.|\.)ok === true/);
  assert.doesNotMatch(app, /supabaseStatus\?\.ok\s*!==\s*false/);
  assert.doesNotMatch(app, /oneDriveServiceStatus\?\.ok\s*!==\s*false/);
});
