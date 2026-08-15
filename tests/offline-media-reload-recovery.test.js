import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreProjectOfflineMedia } from '../src/lib/offline/projectSessionStore.js';

test('reload reconstructs list, nested measurement and exterior media from durable transaction blobs', async () => {
  const calls = [];
  const blobs = new Map([
    ['tx-image', { blob: new Blob(['image']), entityId: 'img-1' }],
    ['tx-measure', { blob: new Blob(['measure']), entityId: 'measurement-1' }],
    ['tx-exterior', { blob: new Blob(['exterior']), entityId: 'exterior-1' }],
  ]);
  const project = {
    id: 'p1',
    images: [{ id: 'img-1', preview: 'blob:dead', offlineTransactionId: 'tx-image' }],
    measurementRooms: [{ measurements: [{
      id: 'measurement-1', preview: 'blob:dead-2', offlineTransactionId: 'tx-measure',
    }] }],
    exteriorPhoto: 'blob:dead-3',
    exteriorPhotoOfflineTransactionId: 'tx-exterior',
  };
  const result = await restoreProjectOfflineMedia(project, {
    loadVerifiedBlob: async (transactionId, entityId) => {
      calls.push([transactionId, entityId]);
      const row = blobs.get(transactionId);
      assert.ok(row, 'transaction must exist');
      if (entityId != null) assert.equal(entityId, row.entityId, 'entity association must be exact');
      return row;
    },
    createObjectURL: blob => `blob:restored-${blob.size}-${calls.length}`,
  });
  assert.equal(result.snapshot.images[0].preview.startsWith('blob:restored-'), true);
  assert.equal(result.snapshot.images[0].url, result.snapshot.images[0].preview);
  assert.equal(result.snapshot.images[0].offlineRecovered, true);
  assert.equal(result.snapshot.measurementRooms[0].measurements[0].offlineRecovered, true);
  assert.equal(result.snapshot.exteriorPhoto.startsWith('blob:restored-'), true);
  assert.deepEqual(calls, [
    ['tx-image', 'img-1'], ['tx-measure', 'measurement-1'], ['tx-exterior', undefined],
  ]);
  assert.equal(result.objectUrls.length, 3);
  assert.equal(project.images[0].preview, 'blob:dead', 'source snapshot remains immutable');
});

test('reload fails closed when transaction/entity association is not verifiable', async () => {
  await assert.rejects(
    restoreProjectOfflineMedia(
      { images: [{ id: 'wanted', offlineTransactionId: 'tx-wrong' }] },
      { loadVerifiedBlob: async (_tx, entity) => { throw new Error(`association:${entity}`); } },
    ),
    /association:wanted/,
  );
});

test('reload revokes already-created object URLs when a later recovery item fails', async () => {
  const revoked = [];
  await assert.rejects(
    restoreProjectOfflineMedia(
      {
        images: [
          { id: 'ok', offlineTransactionId: 'tx-ok' },
          { id: 'broken', offlineTransactionId: 'tx-broken' },
        ],
      },
      {
        loadVerifiedBlob: async transactionId => {
          if (transactionId === 'tx-broken') throw new Error('later recovery failed');
          return { blob: new Blob(['safe']) };
        },
        createObjectURL: () => 'blob:must-be-revoked',
        revokeObjectURL: url => revoked.push(url),
      },
    ),
    /later recovery failed/,
  );
  assert.deepEqual(revoked, ['blob:must-be-revoked']);
});
