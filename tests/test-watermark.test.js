import test from 'node:test';
import assert from 'node:assert/strict';

// Simulated environment check & HEIC check for applyTestWatermark
function testWatermarkProcessing(fileBlob, fileName) {
  const fileNameLower = fileName.toLowerCase();
  
  if (fileBlob.type === 'image/heic' || fileBlob.type === 'image/heif' || fileNameLower.endsWith('.heic') || fileNameLower.endsWith('.heif')) {
    throw new Error(`[HEIC BLOCKED] HEIC-Datei '${fileName}' im ersten OneDrive-Test nicht zugelassen.`);
  }

  if (!fileBlob || fileBlob.size === 0) {
    throw new Error('[WATERMARK ABORT] Eingabeblob ist leer.');
  }

  // Simulated canvas watermark transformation
  const stampedBlob = {
    name: fileName,
    type: fileBlob.type === 'image/png' ? 'image/png' : 'image/jpeg',
    size: fileBlob.size + 450, // Modified size due to added banner pixels
    isStamped: true
  };

  if (stampedBlob.size <= fileBlob.size) {
    throw new Error('[WATERMARK ABORT] Ausgabeblob hat sich nicht vom Original unterschieden.');
  }

  return stampedBlob;
}

test('1. Watermark - Valid JPEG Image Processing', () => {
  const input = { type: 'image/jpeg', size: 12000 };
  const output = testWatermarkProcessing(input, 'TEST__foto.jpg');

  assert.equal(output.isStamped, true);
  assert.equal(output.type, 'image/jpeg');
  assert.ok(output.size > input.size);
});

test('2. Watermark - Valid PNG Image Processing', () => {
  const input = { type: 'image/png', size: 25000 };
  const output = testWatermarkProcessing(input, 'TEST__foto.png');

  assert.equal(output.isStamped, true);
  assert.equal(output.type, 'image/png');
  assert.ok(output.size > input.size);
});

test('3. Watermark - HEIC Blockade Test', () => {
  const input = { type: 'image/heic', size: 15000 };
  assert.throws(() => {
    testWatermarkProcessing(input, 'TEST__foto.heic');
  }, /HEIC-Datei/);
});

test('4. Watermark - Empty Blob Blockade Test', () => {
  const input = { type: 'image/jpeg', size: 0 };
  assert.throws(() => {
    testWatermarkProcessing(input, 'TEST__empty.jpg');
  }, /Eingabeblob ist leer/);
});
