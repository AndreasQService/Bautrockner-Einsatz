import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isHeicHeifPhoto } from '../src/lib/photoFormat.js';

test('HEIC and HEIF detection accepts MIME and durable filename locations', () => {
  assert.equal(isHeicHeifPhoto({ name: 'IMG_1234.HEIC' }), true);
  assert.equal(isHeicHeifPhoto({ type: 'image/heif' }), true);
  assert.equal(isHeicHeifPhoto({ original: { mimeType: 'image/heic-sequence' } }), true);
  assert.equal(isHeicHeifPhoto({ type: 'image', file: { type: 'image/heic' } }), true);
  assert.equal(isHeicHeifPhoto({ type: 'image', blob: { type: 'image/heif' } }), true);
  assert.equal(isHeicHeifPhoto({ type: 'image', original: { blob: { type: 'image/heic' } } }), true);
  assert.equal(isHeicHeifPhoto({ storagePath: 'cases/p1/photo.heif?token=x' }), true);
  assert.equal(isHeicHeifPhoto({ oneDrivePath: 'QTool/p1/Fotos/photo.heic' }), true);
  assert.equal(isHeicHeifPhoto({ name: 'photo.jpeg', type: 'image/jpeg' }), false);
});

test('active photo cards show a HEIC warning independent from cloud verification', () => {
  const form = fs.readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  assert.match(form, /HEIC – eingeschränkt unterstützt/);
  assert.match(form, /isHeicHeifPhoto\(photo\)/);
  assert.match(form, /const HeicFormatBadge/);
  assert.match(form, /<HeicFormatBadge photo=\{img\}/);
  assert.match(form, /<HeicFormatBadge photo=\{item\} compact/);
  assert.match(form, /<HeicFormatBadge photo=\{thermalImg\} compact/);
  assert.doesNotMatch(fs.readFileSync(new URL('../src/lib/photoFormat.js', import.meta.url), 'utf8'), /verifiedPhotoKeys|syncStatus|oneDriveItemId/);
});
