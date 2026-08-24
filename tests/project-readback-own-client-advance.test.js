import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('finish accepts a server-normalized readback only for the same client and a non-older version', () => {
  assert.match(appSource, /const exactPayloadMatch = expectedPayload/);
  assert.match(appSource, /readback\.report_data\?\.last_edited_client_id === getOrCreateClientId\(\)/);
  assert.match(appSource, /readbackVersion >= expectedVersion/);
  assert.match(appSource, /if \(!exactPayloadMatch && !sameConfirmedClient\)/);
});

test('finish adopts the verified server payload before releasing the lock', () => {
  const adopt = appSource.indexOf('confirmedProjectPayloadRef.current.set(\n        reportId');
  const release = appSource.indexOf('if (await releaseProjectLock() !== true)', adopt);
  assert.ok(adopt >= 0, 'verified readback must be adopted');
  assert.ok(release > adopt, 'lock must be released only after adopting verified readback');
});
