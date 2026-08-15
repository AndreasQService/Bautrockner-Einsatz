import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { queueOneDriveTransfer } from '../src/lib/offline/supabaseMediaHandlers.js';

const base = {
  projectId: 'TEST__P1', entityId: 'image-1', filename: 'TEST__a.jpg', mimeType: 'image/jpeg',
  size: 123, checksum: 'a'.repeat(64), bucket: 'case-files', path: 'cases/p/images/a.jpg',
  remotePath: 'QTool_TEST_ONLY/TESTRUN_2026-08-14_120000_ABCD/TEST__P1/Fotos/TEST__a.jpg',
};

function client(transform = value => value) {
  let written;
  const chain = {
    upsert(value) { written = value; return chain; },
    select() { return chain; },
    single: async () => ({ data: transform(written), error: null }),
  };
  return { from(table) { assert.equal(table, 'project_image_uploads'); return chain; }, get written() { return written; } };
}

test('new bytes queue the exact worker state and atomically clear all stale proof', async () => {
  const db = client();
  await queueOneDriveTransfer(db, base);
  assert.equal(db.written.storage_status, 'uploaded_to_backend');
  for (const key of ['remote_drive_id', 'remote_item_id', 'remote_etag', 'remote_size_bytes', 'remote_sha256', 'verified_at']) {
    assert.equal(db.written[key], null, `${key} must be invalidated`);
  }
  assert.equal(db.written.sha256, base.checksum);
  assert.equal(db.written.remote_path, base.remotePath);
});

test('queue fails closed if database returns stale remote proof', async () => {
  await assert.rejects(
    queueOneDriveTransfer(client(value => ({ ...value, remote_item_id: 'old-item' })), base),
    /Evidenz-Invalidierung stimmt im Readback nicht/,
  );
});

test('queue refuses incomplete/non-attributable transfer', async () => {
  await assert.rejects(queueOneDriveTransfer(client(), { ...base, remotePath: null }), /ohne Projekt, Entity, Zielpfad oder SHA-256/);
  await assert.rejects(queueOneDriveTransfer(client(), { ...base, checksum: 'not-a-hash' }), /ohne Projekt, Entity, Zielpfad oder SHA-256/);
});

test('case documents, images and measurement protocols all use the same invalidating queue', () => {
  const media = readFileSync(new URL('../src/lib/offline/supabaseMediaHandlers.js', import.meta.url), 'utf8');
  const domain = readFileSync(new URL('../src/lib/offline/supabaseDomainHandlers.js', import.meta.url), 'utf8');
  const caseBranch = media.match(/if \(operation\.payload\?\.kind === 'case_document'\)[\s\S]*?\n\s{4}}\n\s{4}const entityId/)?.[0] || '';
  assert.match(caseBranch, /queueOneDriveTransfer\(supabase/);
  assert.match(media, /const entityId[\s\S]*?queueOneDriveTransfer\(supabase/);
  assert.match(domain, /Protokoll-SHA-256[\s\S]*?queueOneDriveTransfer\(supabase/);
});
