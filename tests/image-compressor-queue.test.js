import test from 'node:test';
import assert from 'node:assert/strict';
import { convertHeicToJpeg } from '../src/utils/imageCompressor.js';

test('HEIC converter accepts only a real JPEG signature and MIME', async () => {
  const heic = new Blob([new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])], { type: 'image/heic' });
  const jpeg = await convertHeicToJpeg(heic, async ({ blob, toType }) => {
    assert.equal(blob.type, 'image/heic');
    assert.equal(toType, 'image/jpeg');
    return new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3])], { type: 'image/jpeg' });
  });
  assert.equal(jpeg.type, 'image/jpeg');
  assert.deepEqual([...new Uint8Array(await jpeg.slice(0, 3).arrayBuffer())], [0xFF, 0xD8, 0xFF]);
});

test('one unreadable file is isolated and the next compression queue item completes', async () => {
  const originalImage = globalThis.Image;
  const originalDocument = globalThis.document;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let imageAttempt = 0;
  const objectKinds = new Map();

  class FakeImage {
    constructor() { this.width = 100; this.height = 80; this.naturalWidth = 100; this.naturalHeight = 80; }
    set src(value) {
      if (!value) return;
      imageAttempt += 1;
      queueMicrotask(() => value.includes('broken') ? this.onerror?.({ type: 'error' }) : this.onload?.());
    }
  }
  globalThis.Image = FakeImage;
  globalThis.document = { createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({ drawImage() {} }),
    toBlob: callback => queueMicrotask(() => callback(new Blob(['jpeg'], { type: 'image/jpeg' })))
  }) };
  URL.createObjectURL = blob => {
    const kind = blob?.name === 'broken.jpg' ? 'broken' : 'good';
    const url = `blob:${kind}-${imageAttempt}`;
    objectKinds.set(url, kind);
    return url;
  };
  URL.revokeObjectURL = () => {};

  try {
    const { queueImageCompression } = await import(`../src/utils/imageCompressor.js?queue-test=${Date.now()}`);
    const broken = new Blob(['broken'], { type: 'image/jpeg' });
    Object.defineProperty(broken, 'name', { value: 'broken.jpg' });
    const good = new Blob(['good'], { type: 'image/jpeg' });
    Object.defineProperty(good, 'name', { value: 'good.jpg' });

    await assert.rejects(queueImageCompression(broken), /IMAGE_DECODE_UNREADABLE/);
    const result = await queueImageCompression(good);
    assert.equal(result.compressed.mimeType, 'image/jpeg');
    assert.ok(result.compressed.size > 0);
  } finally {
    globalThis.Image = originalImage;
    globalThis.document = originalDocument;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
