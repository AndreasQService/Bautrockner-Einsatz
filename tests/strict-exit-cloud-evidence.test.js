import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { collectStrictExitCloudEvidence } from '../src/lib/offline/exitCloudEvidence.js';

globalThis.crypto ||= webcrypto;
const bytes = new Blob(['proof'], { type: 'application/octet-stream' });
const checksum = 'c1cda26362828b69266512052b97cb3729e3b052e4ade47c0a1e3383defe73c7';

function client({ remoteSha = checksum, downloaded = bytes } = {}) {
  const journal = [{
    project_id: 'p1', local_image_id: 'e1', storage_bucket: 'case-files', storage_path: 'p1/a.bin',
    storage_status: 'remote_verified', size_bytes: bytes.size, sha256: checksum,
    remote_path: 'QTool/p1/a.bin', remote_drive_id: 'drive', remote_item_id: 'item', remote_etag: 'etag',
    remote_size_bytes: bytes.size, remote_sha256: remoteSha, verified_at: '2026-08-14T12:00:00Z',
  }];
  return {
    storage: { from: () => ({ download: async () => ({ data: downloaded, error: null }) }) },
    from: () => ({
      select() { return this; }, eq: async () => ({ data: journal, error: null }),
    }),
  };
}

const session = {
  projectId: 'p1',
  snapshot: { id: 'p1', _offlineMaterialization: { storageArtifacts: [
    { entityId: 'e1', bucket: 'case-files', path: 'p1/a.bin' },
  ] } },
  media: [{ entityId: 'e1', url: 'storage://case-files/p1/a.bin', size: bytes.size, checksum }],
};

test('strict exit evidence is produced from fresh Storage bytes and attributable OneDrive journal', async () => {
  const evidence = await collectStrictExitCloudEvidence(client(), session);
  assert.equal(evidence.storage.verified, true);
  assert.equal(evidence.storage.entries[0].readbackChecksum, checksum);
  assert.equal(evidence.oneDrive.verified, true);
  assert.equal(evidence.oneDrive.entries[0].driveId, 'drive');
});

test('same-size remote corruption fails closed', async () => {
  await assert.rejects(
    collectStrictExitCloudEvidence(client({ remoteSha: 'f'.repeat(64) }), session),
    /OneDrive-Journal-Evidenz/,
  );
});

test('missing local byte metadata can never be inferred from cloud metadata', async () => {
  await assert.rejects(
    collectStrictExitCloudEvidence(client(), { ...session, media: [] }),
    /Lokale Byte-Evidenz fehlt/,
  );
});
