import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, sha256CanonicalProjectContent } from '../src/lib/offline/canonicalDigest.js';

test('canonical snapshot digest ignores object key order but detects equal-count content loss', async () => {
  const original = {
    description: 'Wasserschaden im Bad',
    rooms: [{ id: 'r1', name: 'Bad' }],
    measurementRooms: [{ id: 'r1', measurements: [{ id: 'm1', value: 87 }] }],
  };
  const reordered = {
    measurementRooms: [{ measurements: [{ value: 87, id: 'm1' }], id: 'r1' }],
    rooms: [{ name: 'Bad', id: 'r1' }], description: 'Wasserschaden im Bad',
  };
  const corrupted = { ...original, description: 'ALTER CLOUD-STAND', rooms: [{ id: 'r1', name: 'Küche' }] };
  assert.equal(canonicalJson(original), canonicalJson(reordered));
  assert.equal(await sha256CanonicalProjectContent(original), await sha256CanonicalProjectContent(reordered));
  assert.notEqual(await sha256CanonicalProjectContent(original), await sha256CanonicalProjectContent(corrupted));
});
