import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getProjectSyncSummary, reportCategoryMatches } from '../src/lib/projectSyncSummary.js';
import { storagePathFor, verifyProjectSupabaseSync } from '../src/lib/verifyProjectSupabaseSync.js';

const report = {
  id: 'project-1', projectTitle: 'Test', notes: 'Cloud evidence', contacts: [{ name: 'Andrea' }],
  images: [
    { id: 'photo-1', name: 'one.jpg', storagePath: 'cases/project-1/images/one.jpg' },
    { id: 'photo-2', name: 'two.jpg', storagePath: 'cases/project-1/images/two.jpg' }
  ],
  measurementRooms: [{ id: 'room-1', measurementData: { measurements: [{ w: '12' }] } }],
  equipment: [
    { id: 'local-1', dbId: 'owned-1', deviceNumber: '1001', isRental: false },
    { id: 'local-2', rentalDbId: 'rental-1', deviceNumber: 'R-1', isRental: true }
  ]
};

test('paths and sync flags alone never produce green evidence', () => {
  const summary = getProjectSyncSummary({ ...report, images: report.images.map(image => ({ ...image, syncStatus: 'uploaded_to_backend', supabaseBackedUpAt: 'now' })) });
  assert.equal(summary.rows[0].text, 'Fotos: 0 von 2 synchronisiert');
  assert.equal(summary.rows[3].text, 'Geräte: 0 von 2 synchronisiert');
  assert.equal(summary.complete, false);
});

test('verified evidence yields exact user-facing counts', () => {
  const summary = getProjectSyncSummary(report, {
    verifiedPhotoKeys: ['photo-1'], verifiedDeviceKeys: ['local-1', 'local-2'],
    textVerified: true, protocolsVerified: true
  });
  assert.equal(summary.rows[0].text, 'Fotos: 1 von 2 synchronisiert');
  assert.equal(summary.rows[1].text, 'Messprotokolle: 1 von 1 synchronisiert');
  assert.equal(summary.rows[2].text, 'Texte / Projektdaten: 1 von 1 synchronisiert');
  assert.equal(summary.rows[3].text, 'Geräte: 2 von 2 synchronisiert');
  assert.equal(summary.complete, false);
});

test('all project text and structured metadata participate in the exact comparison', () => {
  assert.equal(reportCategoryMatches(report, structuredClone(report)).text, true);
  assert.equal(reportCategoryMatches(report, { ...structuredClone(report), contacts: [{ name: 'Changed' }] }).text, false);
});

test('storage URLs normalize to a bucket-relative object path', () => {
  assert.equal(storagePathFor({ storagePath: 'https://x.supabase.co/storage/v1/object/public/case-files/cases/p/a.jpg' }), 'cases/p/a.jpg');
});

test('fresh Supabase readbacks are required for every green category', async () => {
  const from = table => {
    const query = {
      select: () => query, eq: () => query,
      single: async () => ({ data: { id: 'project-1', report_data: structuredClone(report) }, error: null }),
      maybeSingle: async () => table === 'devices'
        ? ({ data: { id: 'owned-1', current_report_id: 'project-1' }, error: null })
        : ({ data: { id: 'rental-1', report_id: 'project-1', end_date: null }, error: null })
    };
    return query;
  };
  const supabase = {
    from,
    storage: { from: () => ({ list: async (_folder, options) => ({ data: options.search === 'one.jpg' ? [{ id: 'obj-1', name: 'one.jpg' }] : [], error: null }) }) }
  };
  const evidence = await verifyProjectSupabaseSync({ supabase, report });
  assert.deepEqual(evidence.verifiedPhotoKeys, ['photo-1']);
  assert.deepEqual(evidence.verifiedDeviceKeys, ['local-1', 'local-2']);
  assert.equal(evidence.textVerified, true);
  assert.equal(evidence.protocolsVerified, true);
});

test('control box is wired into DamageForm and refreshes both cloud readbacks in a loop', () => {
  const form = fs.readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  const box = fs.readFileSync(new URL('../src/components/ProjectSyncControlBox.jsx', import.meta.url), 'utf8');
  assert.match(form, /<ProjectSyncControlBox[\s\S]*?report=\{formData\}/);
  assert.match(form, /localSaveConfirmed=\{saveState === 'saved' && !isSaving && !isSyncPending\}/);
  assert.match(box, /setInterval\(verify, 60000\)/);
  assert.match(box, /Supabase Synchronisationskontrolle und OneDrive Synchronisationskontrolle/);
  assert.match(box, /verifyProjectSupabaseSync/);
  assert.match(box, /verifyProjectOneDriveSync/);
});

test('durable photo metadata preserves room assignment and room galleries recover legacy rows', () => {
  const worker = fs.readFileSync(new URL('../src/lib/sync/supabaseSyncWorker.js', import.meta.url), 'utf8');
  const form = fs.readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  assert.match(worker, /roomId: photo\.meta\?\.roomId \?\? null/);
  assert.match(form, /img\.assignedTo === room\.name/);
});
