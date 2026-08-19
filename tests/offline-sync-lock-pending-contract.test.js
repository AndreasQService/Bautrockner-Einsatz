import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('offline recovery defers silently until project-lock ownership is proven', () => {
  assert.match(app, /if \(isLockLost && !forceOverwrite\) \{[\s\S]{0,260}Deferred pending project-lock ownership[\s\S]{0,100}return;/);
  assert.doesNotMatch(app, /\(\(dbVersion > localVersion && !isOwnClientUpdate\) \|\| isLockLost\)/);
});

test('a genuinely newer foreign cloud version remains a conflict', () => {
  assert.match(app, /if \(\(dbVersion > localVersion && !isOwnClientUpdate\) && !forceOverwrite\) \{\s*isConflict = true;/);
  assert.match(app, /Der ältere Offline-Stand wurde nicht automatisch übernommen/);
});

test('deferred local recovery resumes after lock ownership is acquired', () => {
  assert.match(app, /if \(isSessionActive && !lastActiveRef\.current\)[\s\S]{0,300}unsavedReportsRef\.current\[selectedReport\.id\][\s\S]{0,120}syncUnsavedReport\(selectedReport\.id, false\)/);
});
