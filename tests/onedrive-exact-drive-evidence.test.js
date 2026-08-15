import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyOneDriveCopy } from '../src/lib/offline/supabaseMediaHandlers.js';

const checksum = 'a'.repeat(64);
const projectId = 'project-1';
const entityId = 'image-1';

function client(journal) {
  return {
    functions: { invoke: async () => ({ error: null }) },
    from() {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: journal, error: null }),
      };
      return chain;
    },
  };
}

const valid = {
  project_id: projectId,
  local_image_id: entityId,
  storage_status: 'remote_verified',
  remote_path: 'QTool_TEST_ONLY/run/file.jpg',
  remote_drive_id: 'company-drive',
  remote_item_id: 'item-1',
  remote_etag: 'etag-1',
  remote_size_bytes: 42,
  remote_sha256: checksum,
  verified_at: '2026-08-14T12:00:00.000Z',
};

test('frontend consumes complete worker evidence without /me/drive access', async () => {
  const evidence = await verifyOneDriveCopy(client(valid), entityId, checksum, 42, projectId);
  assert.equal(evidence.driveId, 'company-drive');
  assert.equal(evidence.checksum, checksum);
  const frontend = readFileSync(new URL('../src/lib/offline/supabaseMediaHandlers.js', import.meta.url), 'utf8');
  assert.doesNotMatch(frontend, /\/me\/drive/);
  assert.doesNotMatch(frontend, /graph\.microsoft\.com/);
});

for (const [label, patch] of [
  ['drive', { remote_drive_id: null }],
  ['project', { project_id: 'wrong-project' }],
  ['entity', { local_image_id: 'wrong-entity' }],
  ['etag', { remote_etag: null }],
  ['size', { remote_size_bytes: 41 }],
  ['sha', { remote_sha256: 'b'.repeat(64) }],
  ['timestamp', { verified_at: null }],
]) {
  test(`frontend fails closed for mismatched ${label} evidence`, async () => {
    await assert.rejects(
      verifyOneDriveCopy(client({ ...valid, ...patch }), entityId, checksum, 42, projectId),
      /Evidenz ist unvollständig oder abweichend/,
    );
  });
}

test('backend proves bytes from exact configured drive and persists all evidence', () => {
  const worker = readFileSync(new URL('../supabase/functions/onedrive-upload-worker/index.ts', import.meta.url), 'utf8');
  assert.match(worker, /drives\/\$\{encodeURIComponent\(DRIVE_ID\)\}\/items\/\$\{encodeURIComponent\(itemId\)\}/);
  assert.match(worker, /\$\{base\}\/content/);
  assert.match(worker, /remote_drive_id: DRIVE_ID/);
  assert.match(worker, /remote_etag: metadata\.eTag/);
  assert.match(worker, /remote_size_bytes: remoteBlob\.size/);
  assert.match(worker, /remote_sha256: remoteSha256/);
  assert.match(worker, /OneDrive Byte-Grösse\/SHA-256 stimmt nicht/);
});
