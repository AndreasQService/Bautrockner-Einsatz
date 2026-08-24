import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../src/services/PhotoStorage.js', import.meta.url),
  'utf8',
);

test('invalidates cached IndexedDB connections when iPadOS closes them', () => {
  assert.match(source, /db\.onversionchange\s*=\s*\(\)\s*=>/);
  assert.match(source, /db\.onclose\s*=\s*\(\)\s*=>\s*invalidateDb\(db\)/);
  assert.match(source, /_db\s*=\s*null/);
});

test('reopens and retries a photo write after a closing-connection error', () => {
  assert.match(source, /function isClosingConnectionError/);
  assert.match(source, /message\.includes\('database connection is closing'\)/);
  assert.match(source, /for \(let attempt = 0; attempt < 2;/);
  assert.match(source, /const tx = await openPhotoWriteTransaction\(\)/);
});

