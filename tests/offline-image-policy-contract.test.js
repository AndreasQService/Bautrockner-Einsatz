import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('central media adapter compresses before its only durable blob write', () => {
  const adapter = read('src/lib/offline/formMediaAdapter.js');
  assert.match(adapter, /prepareImageForDurableStorage\(file\)/);
  assert.match(adapter, /blob:\s*durableFile/);
  assert.match(adapter, /checksum:\s*prepared\.checksum/);
  assert.match(adapter, /getOfflineBlob\(manifest\.blobIds\[0\]\)/);
  assert.doesNotMatch(adapter, /blob:\s*file,\s*\n\s*kind/);
});

test('all active image entry points use central adapter and no longer write PhotoStorage', () => {
  const damageForm = read('src/components/DamageForm.jsx');
  const uploadPanel = read('src/components/UploadPanel.jsx');
  assert.match(damageForm, /kind:\s*isDoc\s*\?\s*'document'\s*:\s*'damage_image'/);
  assert.match(damageForm, /kind:\s*'exterior_image'/);
  assert.match(damageForm, /damage_image_edited/);
  assert.match(damageForm, /registerMeasurementLocally/);
  assert.match(uploadPanel, /registerMediaLocally/);
  assert.doesNotMatch(damageForm, /savePhotoLocally\(/);
  assert.match(uploadPanel, /URL\.createObjectURL\(manifest\.localFile\)/);
});

test('image policy is bounded, verified and hashed', () => {
  const pipeline = read('src/lib/offline/imagePipeline.js');
  assert.match(pipeline, /maxDimension:\s*1920/);
  assert.match(pipeline, /quality:\s*0\.78/);
  assert.match(pipeline, /inspectImageBlob\(blob\)/);
  assert.match(pipeline, /sha256OfBlob\(blob\)/);
  assert.match(pipeline, /import\('heic2any'\)/);
  assert.match(read('src/lib/offline/formMediaAdapter.js'), /originalPersisted:\s*false/);
});

test('retention never prunes active, failed, queued or conflict data', () => {
  const store = read('src/lib/offline/transactionStore.js');
  assert.match(store, /enabled = false/);
  assert.match(store, /if \(enabled !== true\) return \[\]/);
  assert.match(store, /manifest\.status !== OFFLINE_STATES\.CLOUD_CONFIRMED/);
  assert.match(store, /if \(!isCompletedProject\) continue/);
  assert.match(store, /operations\.every\(\(\{ status \}\) => status === OFFLINE_STATES\.CLOUD_CONFIRMED\)/);
});

test('media cloud confirmation requires Supabase and OneDrive byte readback', () => {
  const handler = read('src/lib/offline/supabaseMediaHandlers.js');
  assert.match(handler, /\.download\(target\.path\)/);
  assert.match(handler, /Storage-Prüfsumme stimmt nicht/);
  assert.match(handler, /storage_status !== 'remote_verified'/);
  assert.match(handler, /remote_drive_id/);
  assert.match(handler, /remote_etag/);
  assert.match(handler, /remote_sha256/);
  assert.doesNotMatch(handler, /\/me\/drive/);
  assert.match(handler, /const oneDrive = await verifyOneDriveCopy[\s\S]*markMediaConfirmed/);
});
