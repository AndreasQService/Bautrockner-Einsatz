import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhotoIdentity, createOneDrivePhotoFile } from '../src/lib/photoIdentity.js';
import fs from 'node:fs';
import { scheduleSupabasePhotoRepairs } from '../src/lib/photoRepair.js';
import { itemKey, getProjectPhotoEvidenceKey, hasVerifiedPhotoEvidence } from '../src/lib/projectSyncSummary.js';

test('free duplicate filenames never determine technical identity', async () => {
  const first = new Blob(['first bytes'], { type: 'image/jpeg' });
  const second = new Blob(['different bytes'], { type: 'image/jpeg' });
  Object.defineProperty(first, 'name', { value: 'frei benannt.jpg' });
  Object.defineProperty(second, 'name', { value: 'frei benannt.jpg' });
  const firstIdentity = await createPhotoIdentity(first, () => 'uuid-1');
  const secondIdentity = await createPhotoIdentity(second, () => 'uuid-2');
  assert.equal(firstIdentity.id, 'img_uuid-1');
  assert.equal(secondIdentity.id, 'img_uuid-2');
  assert.notEqual(firstIdentity.contentHash, secondIdentity.contentHash);
});

test('technical evidence and deletion identity never use the free filename', () => {
  const first = { recoveryKey: 'legacy-a', name: 'gleich.jpg', date: 'same', size: 1 };
  const second = { recoveryKey: 'legacy-b', name: 'gleich.jpg', date: 'same', size: 1 };
  assert.equal(itemKey(first, 0), 'legacy-a');
  assert.equal(itemKey(second, 0), 'legacy-b');
  assert.equal(getProjectPhotoEvidenceKey({ images: [first, second] }, first), 'legacy-a');

  const unidentifiedA = { name: 'gleich.jpg', date: 'same', size: 1 };
  const unidentifiedB = { name: 'gleich.jpg', date: 'same', size: 1 };
  assert.equal(getProjectPhotoEvidenceKey({ images: [unidentifiedA, unidentifiedB] }, unidentifiedA), null);
  assert.equal(itemKey(unidentifiedA, 0), 'unidentified:0');
  assert.equal(itemKey(unidentifiedB, 1), 'unidentified:1');
});

test('active intake saves the original before calculating its content hash', () => {
  const form = fs.readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  const intake = form.slice(form.indexOf('const handleImageUpload'), form.indexOf('const handleRoomImageDrop'));
  assert.ok(intake.indexOf('savePhotoLocally(imageId') < intake.indexOf('calculatePhotoContentHash(file)'));
});

test('missing Supabase object schedules exact id once and stops after green evidence', async () => {
  const scheduled = new Set();
  const updates = [];
  let syncCount = 0;
  const updateStatus = async (id, patch) => updates.push({ id, patch });
  const sync = async () => { syncCount += 1; };
  await scheduleSupabasePhotoRepairs({
    results: [{ id: 'img_uuid-1', name: 'same.jpg', verified: false, reason: 'MISSING_SUPABASE_OBJECT' }],
    scheduled, updateStatus, sync
  });
  await scheduleSupabasePhotoRepairs({
    results: [{ id: 'img_uuid-1', name: 'same.jpg', verified: true, reason: null }],
    scheduled, updateStatus, sync
  });
  assert.deepEqual(updates.map(entry => entry.id), ['img_uuid-1']);
  assert.equal(syncCount, 1);
});

test('OneDrive eligibility stays blocked until the same photo has fresh Supabase evidence', () => {
  const photo = { id: 'img-1', storagePath: 'project/Fotos/img-1.jpg' };
  const report = { images: [photo] };
  assert.equal(hasVerifiedPhotoEvidence(report, photo, []), false);
  assert.equal(hasVerifiedPhotoEvidence(report, photo, ['img-other']), false);
  assert.equal(hasVerifiedPhotoEvidence(report, photo, ['img-1']), true);
});

test('converted HEIC reaches OneDrive as technical JPEG regardless of the free filename', async () => {
  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])], { type: 'application/octet-stream' });
  const file = await createOneDrivePhotoFile({ id: 'img_uuid-7', name: 'Mein freier Name.heic', convertedFromHeic: true }, jpeg);
  assert.equal(file.name, 'img_uuid-7.jpg');
  assert.equal(file.type, 'image/jpeg');
  assert.deepEqual([...new Uint8Array(await file.slice(0, 3).arrayBuffer())], [0xff, 0xd8, 0xff]);
  await assert.rejects(
    createOneDrivePhotoFile({ id: 'img_uuid-7', name: 'Mein freier Name.heic', convertedFromHeic: true }, new Blob(['not jpeg'])),
    /ONEDRIVE_CONVERTED_JPEG_INVALID/
  );
});
