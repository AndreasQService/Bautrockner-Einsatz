import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const compressor = fs.readFileSync(new URL('../src/utils/imageCompressor.js', import.meta.url), 'utf8');

test('image decoder promises cannot block the global compression queue forever', () => {
  assert.match(compressor, /export const IMAGE_DECODE_TIMEOUT_MS = 5000/);
  assert.match(compressor, /Image decode timed out after/);
  assert.match(compressor, /Dimension check timed out for/);
  assert.match(compressor, /clearTimeout\(decodeTimeout\)/);
  assert.match(compressor, /clearTimeout\(timeoutId\)/);
});

test('HEIC converts before canvas while unreadable ordinary images fail closed', () => {
  const fallback = compressor.slice(compressor.indexOf('try {', compressor.indexOf('let compressedBlob')), compressor.indexOf('const compressedSha'));
  assert.match(fallback, /compressSingleImage/);
  assert.match(fallback, /catch \(compressionErr\)/);
  assert.match(compressor, /import\('heic2any'\)/);
  assert.match(compressor, /HEIC_CONVERSION_TIMEOUT/);
  assert.match(compressor, /convertedFromHeic: isHeic/);
  assert.match(fallback, /IMAGE_DECODE_UNREADABLE/);
  assert.match(compressor, /cloudExtension: isHeic \? 'jpg'/);
});
