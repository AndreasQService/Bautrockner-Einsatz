import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('successful silent autosaves do not repeatedly display success toasts', () => {
  const successCalls = app.match(/(?:if \(!silent\) )?showToast\('✅ Projekt(?: und Foto)? erfolgreich gespeichert!', 'success'\);/g) || [];
  assert.ok(successCalls.length >= 3, 'expected all project-save success branches');
  for (const call of successCalls) {
    assert.match(call, /^if \(!silent\) showToast/);
  }
});
