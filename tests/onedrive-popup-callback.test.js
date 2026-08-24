import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isOneDrivePopupCallback } from '../src/lib/onedrive/popupCallback.js';
import { completeOneDrivePopup } from '../src/lib/onedrive/popupBridge.js';

test('detects an authorization-code response in an opened popup', () => {
  assert.equal(isOneDrivePopupCallback({ hash: '#code=abc&state=xyz' }, true), true);
});

test('detects the live MSAL fragment even when state is not visible', () => {
  assert.equal(isOneDrivePopupCallback({ hash: '#code=1.AXkA-live-response' }, true), true);
});

test('detects an MSAL fragment when browser isolation removes window.opener', () => {
  assert.equal(isOneDrivePopupCallback({ hash: '#code=abc&state=xyz' }, false), true);
  assert.equal(isOneDrivePopupCallback({ hash: '#code=abc' }, false), true);
});

test('detects an OAuth error response in an opened popup', () => {
  assert.equal(isOneDrivePopupCallback({ search: '?error=access_denied&state=xyz' }, true), true);
});

test('does not classify an ordinary main-window URL as a popup callback', () => {
  assert.equal(isOneDrivePopupCallback({ hash: '#dashboard' }, false), false);
  assert.equal(isOneDrivePopupCallback({ search: '?project=code' }, false), false);
});

test('rejects ordinary hashes and incomplete OAuth responses', () => {
  assert.equal(isOneDrivePopupCallback({ hash: '#dashboard' }, true), false);
  assert.equal(isOneDrivePopupCallback({ hash: '#state=xyz' }, true), false);
  assert.equal(isOneDrivePopupCallback({ hash: '#code=' }, true), false);
  assert.equal(isOneDrivePopupCallback({ search: '?code=abc' }, false), false);
});

test('popup callback branch precedes sync worker and full app boot', async () => {
  const source = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const branch = source.indexOf('if (isPopupCallback)');
  const syncBoot = source.indexOf("import('./lib/sync/supabaseSyncWorker.js')");
  const appBoot = source.indexOf("import('./App.jsx')");

  assert.ok(branch >= 0);
  assert.ok(syncBoot > branch);
  assert.ok(appBoot > branch);
  assert.match(source, /completeOneDrivePopup\(\)/);
});

test('popup completion delegates exactly once to the official MSAL bridge', async () => {
  let calls = 0;
  const expected = Symbol('completed');
  const result = await completeOneDrivePopup(async () => {
    calls += 1;
    return expected;
  });

  assert.equal(calls, 1);
  assert.equal(result, expected);
});

test('official MSAL bridge broadcasts the callback and closes the popup', async () => {
  const previousWindow = globalThis.window;
  const previousBroadcastChannel = globalThis.BroadcastChannel;
  const libraryState = Buffer.from(JSON.stringify({
    id: 'onedrive-popup-test',
    meta: { interactionType: 'popup' },
  })).toString('base64url');
  const messages = [];
  let channelClosed = false;
  let popupClosed = false;

  class FakeBroadcastChannel {
    constructor(name) {
      assert.equal(name, 'onedrive-popup-test');
    }

    postMessage(message) {
      messages.push(message);
    }

    close() {
      channelClosed = true;
    }
  }

  globalThis.BroadcastChannel = FakeBroadcastChannel;
  globalThis.window = {
    location: {
      hash: `#code=real-code&state=${libraryState}`,
      search: '',
      origin: 'https://example.test',
      pathname: '/',
    },
    history: { replaceState() {} },
    close() { popupClosed = true; },
  };

  try {
    await completeOneDrivePopup();
    assert.equal(messages.length, 1);
    assert.match(messages[0].payload, /code=real-code/);
    assert.equal(channelClosed, true);
    assert.equal(popupClosed, true);
  } finally {
    globalThis.window = previousWindow;
    globalThis.BroadcastChannel = previousBroadcastChannel;
  }
});
