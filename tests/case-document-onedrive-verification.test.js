import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyOneDriveCopy } from '../src/lib/offline/supabaseMediaHandlers.js';

const checksum = 'a'.repeat(64);
const exact = {
  project_id: 'project-1', local_image_id: 'doc-local-1', storage_status: 'remote_verified',
  remote_path: 'QTool_TEST_ONLY/run/project/Dokumente/doc.pdf', remote_drive_id: 'company-drive-1',
  remote_item_id: 'item-1', remote_etag: 'etag-1', remote_size_bytes: 123,
  remote_sha256: checksum, verified_at: '2026-08-14T12:00:00.000Z',
};

function supabaseJournal(journal, invokeError = null) {
  return {
    functions: { invoke: async () => ({ error: invokeError }) },
    from(table) {
      assert.equal(table, 'project_image_uploads');
      const chain = {
        select: () => chain,
        eq: (column, value) => {
          assert.equal(column, 'local_image_id');
          assert.equal(value, 'doc-local-1');
          return chain;
        },
        maybeSingle: async () => ({ data: journal, error: null }),
      };
      return chain;
    },
  };
}

test('case document becomes worker-processable and awaits exact-drive proof', () => {
  const source = readFileSync(new URL('../src/lib/offline/supabaseMediaHandlers.js', import.meta.url), 'utf8');
  const branch = source.match(/if \(operation\.payload\?\.kind === 'case_document'\)[\s\S]*?\n\s{4}}\n\s{4}const entityId/)?.[0] || '';
  assert.match(branch, /queueOneDriveTransfer\(supabase/);
  assert.match(source, /storage_status: 'uploaded_to_backend'/);
  assert.match(branch, /verifyOneDriveCopy\(supabase, documentEntityId, checksum, downloaded\.size, projectId\)/);
});

test('accepts only complete service-principal exact-drive evidence', async () => {
  assert.deepEqual(await verifyOneDriveCopy(supabaseJournal(exact), 'doc-local-1', checksum, 123, 'project-1'), {
    itemId: 'item-1', driveId: 'company-drive-1', eTag: 'etag-1', path: exact.remote_path,
    size: 123, checksum, verifiedAt: exact.verified_at,
  });
});

for (const [name, patch] of [
  ['wrong project', { project_id: 'project-2' }], ['wrong entity', { local_image_id: 'other-entity' }],
  ['missing drive', { remote_drive_id: null }], ['missing item', { remote_item_id: null }],
  ['missing eTag', { remote_etag: null }], ['same-size corruption proof', { remote_sha256: 'b'.repeat(64) }],
  ['wrong size', { remote_size_bytes: 124 }], ['stale/incomplete evidence', { verified_at: null }],
]) {
  test(`fails closed on ${name}`, async () => {
    await assert.rejects(
      verifyOneDriveCopy(supabaseJournal({ ...exact, ...patch }), 'doc-local-1', checksum, 123, 'project-1'),
      /Evidenz|Endbestätigung/,
    );
  });
}

test('Graph/worker 401/403/404 failures remain retryable and cannot confirm', async () => {
  for (const status of [401, 403, 404]) {
    const error = Object.assign(new Error(`worker ${status}`), { status });
    await assert.rejects(
      verifyOneDriveCopy(supabaseJournal(exact, error), 'doc-local-1', checksum, 123, 'project-1'),
      candidate => candidate === error && candidate.retryable === true,
    );
  }
});

test('production offline verification contains no personal /me/drive path', () => {
  const source = readFileSync(new URL('../src/lib/offline/supabaseMediaHandlers.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\/me\/drive/);
});
