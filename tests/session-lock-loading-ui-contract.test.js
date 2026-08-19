import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const hook = fs.readFileSync(new URL('../src/hooks/useSessionLock.js', import.meta.url), 'utf8');

test('pending ownership stays read-only without claiming a foreign lock', () => {
  assert.match(app, /const isReadOnly = lockRequired && !isSessionActive/);
  assert.match(app, /confirmedForeignLockProjectId === selectedReport\?\.id/);
  assert.doesNotMatch(app, /const isLockedByOtherMode[^\n]+:\s*!isSessionActive/);
});

test('foreign-lock evidence is project-scoped and reset on project change', () => {
  assert.match(hook, /confirmedForeignLockProjectId/);
  assert.match(hook, /setConfirmedForeignLockProjectId\(null\);[\s\S]{0,220}\}, \[selectedReportId\]\)/);
  assert.match(hook, /hasConfirmedForeignOwner \? myProjectId : null/);
});
