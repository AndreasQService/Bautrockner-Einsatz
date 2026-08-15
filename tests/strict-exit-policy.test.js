import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStrictExitReadiness } from '../src/lib/offline/strictExitPolicy.js';

const complete = () => ({
  localConfirmed: true,
  dbEvidence: { verified: true, id: 'p1', version: 4 },
  storageEvidence: { verified: true, artifactCount: 1, entries: [{ readbackSize: 4, readbackChecksum: 'a'.repeat(64) }] },
  oneDriveEvidence: {
    verified: true, itemId: 'journal:1', eTag: 'b'.repeat(64), checksum: 'b'.repeat(64),
    artifactCount: 1,
    entries: [{ driveId: 'drive', itemId: 'od1', eTag: 'etag', size: 4, checksum: 'a'.repeat(64) }],
  },
  outboxSummary: { total: 0, byStatus: { queued: 0, uploading: 0, failed: 0, conflict: 0 } },
  legacyUploadSummary: { total: 0, verified: 0, pending: 0, uploading: 0, uploaded: 0, failed: 0, needsRepair: 0 },
  unverifiedOneDriveMedia: [],
  contentEvidence: { verified: true, expected: { images: 7 }, confirmed: { images: 7 }, mismatches: [] },
});

test('only complete evidence produces fully_confirmed', () => {
  assert.deepEqual(buildStrictExitReadiness(complete()).status, 'fully_confirmed');
});

for (const [name, mutate, reason] of [
  ['offline local-only', value => { value.dbEvidence = null; value.oneDriveEvidence = null; }, 'supabase_db_unconfirmed'],
  ['pending upload', value => { value.outboxSummary = { total: 1, byStatus: { uploading: 1 } }; }, 'outbox_not_empty'],
  ['failed upload', value => { value.outboxSummary = { total: 1, byStatus: { failed: 1 } }; }, 'outbox_not_empty'],
  ['conflict', value => { value.outboxSummary = { total: 1, byStatus: { conflict: 1 } }; }, 'outbox_not_empty'],
  ['image without OneDrive hash', value => { value.unverifiedOneDriveMedia = ['project.images[0]']; }, 'onedrive_media_unconfirmed'],
  ['content mismatch', value => { value.contentEvidence = { verified: false, mismatches: ['images'] }; }, 'content_exact_match_unconfirmed'],
  ['legacy upload unverified', value => { value.legacyUploadSummary = { total: 1, verified: 0, uploaded: 1 }; }, 'legacy_upload_queue_unconfirmed'],
]) {
  test(`${name} blocks exit`, () => {
    const value = complete();
    mutate(value);
    const result = buildStrictExitReadiness(value);
    assert.equal(result.status, 'blocked');
    assert.ok(result.reasons.includes(reason));
  });
}
