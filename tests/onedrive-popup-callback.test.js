import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isOneDrivePopupCallback } from '../src/lib/onedrive/popupCallback.js';

test('detects an authorization-code response in an opened popup', () => {
  assert.equal(isOneDrivePopupCallback({ hash: '#code=abc&state=xyz' }, true), true);
});

test('detects an OAuth error response in an opened popup', () => {
  assert.equal(isOneDrivePopupCallback({ search: '?error=access_denied&state=xyz' }, true), true);
});

test('does not classify the main window as a popup callback', () => {
  assert.equal(isOneDrivePopupCallback({ hash: '#code=abc&state=xyz' }, false), false);
});

test('rejects ordinary hashes and incomplete OAuth responses', () => {
  assert.equal(isOneDrivePopupCallback({ hash: '#dashboard' }, true), false);
  assert.equal(isOneDrivePopupCallback({ hash: '#state=xyz' }, true), false);
  assert.equal(isOneDrivePopupCallback({ hash: '#code=abc' }, true), false);
});

test('popup callback branch precedes sync worker and full app boot', async () => {
  const source = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const branch = source.indexOf('if (isPopupCallback)');
  const syncBoot = source.indexOf("import('./lib/sync/supabaseSyncWorker.js')");
  const appBoot = source.indexOf("import('./App.jsx')");

  assert.ok(branch >= 0);
  assert.ok(syncBoot > branch);
  assert.ok(appBoot > branch);
});
