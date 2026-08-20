import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyProjectOneDriveSync } from '../src/lib/verifyProjectOneDriveSync.js';

const report = {
  id: 'p-1', projectNumber: '100', street: 'Testweg 1', city: 'Zürich', projectTitle: 'Test',
  images: [
    { id: 'photo-1', name: 'a.jpg', oneDriveItemId: 'drive-photo-1' },
    { id: 'photo-2', name: 'b.jpg', oneDrivePath: 'QTool/100_Testweg_1_Zuerich/Fotos/b.jpg' },
    { id: 'photo-3', name: 'local.jpg', oneDriveItemId: 'stale-id' }
  ],
  measurementRooms: [{ id: 'r-1', measurementData: { measurements: [{ w: '3' }] } }],
  equipment: [{ id: 'device-1', deviceNumber: '1001' }]
};

const response = (body, ok = true, status = 200) => ({ ok, status, json: async () => structuredClone(body) });

test('OneDrive verification requires fresh Graph metadata and project JSON content', async () => {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    if (url.includes('/root:/QTool/100_Testweg_1_Zuerich/Projektdaten.json:')) return response({ id: 'json-1', name: 'Projektdaten.json', size: 500, file: {} });
    if (url.includes('/items/json-1/content')) return response(report);
    if (url.includes('/items/drive-photo-1?')) return response({ id: 'drive-photo-1', name: 'a.jpg', size: 25, file: {} });
    if (url.includes('/root:/QTool/100_Testweg_1_Zuerich/Fotos/b.jpg:')) return response({ id: 'drive-photo-2', name: 'b.jpg', size: 30, file: {} });
    if (url.includes('/items/stale-id?')) return response({}, false, 404);
    throw new Error(`Unexpected URL ${url}`);
  };
  const evidence = await verifyProjectOneDriveSync({ report, tokenProvider: async () => 'token', fetchImpl });
  assert.deepEqual(evidence.verifiedPhotoKeys, ['photo-1', 'photo-2']);
  assert.deepEqual(evidence.verifiedDeviceKeys, ['device-1']);
  assert.equal(evidence.textVerified, true);
  assert.equal(evidence.protocolsVerified, true);
  assert.ok(calls.every(url => url.startsWith('https://graph.microsoft.com/v1.0')));
});

test('missing silent OneDrive authentication fails closed without Graph requests', async () => {
  let fetchCalled = false;
  await assert.rejects(
    verifyProjectOneDriveSync({ report, tokenProvider: async () => null, fetchImpl: async () => { fetchCalled = true; } }),
    /nicht verbunden/
  );
  assert.equal(fetchCalled, false);
});
