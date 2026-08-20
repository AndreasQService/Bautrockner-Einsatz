import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('background project sync never opens an indefinite progress toast', () => {
  assert.doesNotMatch(appSource, /showToast\(`Synchronisiere[\s\S]*?,\s*'info',\s*0\)/);
});

test('successful background sync uses persistent status evidence instead of a blinking success toast', () => {
  assert.doesNotMatch(appSource, /showToast\(`✅[\s\S]*?erfolgreich synchronisiert/);
  assert.match(appSource, /delete next\[reportId\]/);
  assert.match(appSource, /confirmedProjectPayloadRef\.current\.set\(reportId/);
});

test('real sync conflicts remain visible as errors', () => {
  assert.match(appSource, /Sync-Konflikt bei/);
  assert.match(appSource, /showToast\([\s\S]*?'error',\s*15000\)/);
});
