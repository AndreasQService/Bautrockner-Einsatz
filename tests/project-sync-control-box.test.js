import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  getProjectPhotoCandidates,
  getProjectSyncSummary,
  reportCategoryMatches
} from '../src/lib/projectSyncSummary.js';
import {
  storagePathFor,
  verifyProjectSupabaseSync
} from '../src/lib/verifyProjectSupabaseSync.js';
import { verifyProjectOneDriveSync } from '../src/lib/verifyProjectOneDriveSync.js';

const measuredRoom = {
  id: 'room-1',
  name: 'Keller',
  measurementData: { measurements: [{ w: '32', b: '18' }] }
};

const report = {
  id: 'report-1',
  projectTitle: 'Wasserschaden',
  orderNumber: 'A-100',
  images: [
    { id: 'photo-1', name: 'a.jpg', supabasePath: 'report-1/Fotos/a.jpg', syncStatus: 'synced' },
    { id: 'photo-2', name: 'b.jpg', storagePath: 'report-1/Fotos/b.jpg', oneDriveItemId: 'od-2' }
  ],
  measurementRooms: [measuredRoom],
  equipment: [
    { id: 'local-device-1', dbId: 'device-1', deviceNumber: '1001' },
    { id: 'local-rental-1', rentalDbId: 'rental-1', isRental: true, deviceNumber: 'M-7' }
  ]
};

test('summary is fail-closed: paths, sync flags and OneDrive ids alone never turn Supabase rows green', () => {
  const summary = getProjectSyncSummary(report);
  assert.deepEqual(summary.rows.map(row => [row.label, row.synced, row.total]), [
    ['Fotos', 0, 2],
    ['Messprotokolle', 0, 1],
    ['Texte / Projektdaten', 0, 1],
    ['Geräte', 0, 2]
  ]);
  assert.equal(summary.complete, false);
});

test('summary only counts evidence keys returned by a real verification pass', () => {
  const summary = getProjectSyncSummary(report, {
    verifiedPhotoKeys: ['photo-1'],
    verifiedDeviceKeys: ['local-device-1'],
    textVerified: true,
    protocolsVerified: true
  });
  assert.equal(summary.rows[0].text, 'Fotos: 1 von 2 synchronisiert');
  assert.equal(summary.rows[1].text, 'Messprotokolle: 1 von 1 synchronisiert');
  assert.equal(summary.rows[2].text, 'Texte / Projektdaten: 1 von 1 synchronisiert');
  assert.equal(summary.rows[3].text, 'Geräte: 1 von 2 synchronisiert');
  assert.equal(summary.complete, false);
});

test('two distinct local photos with the same filename remain two pending objects', () => {
  const photos = getProjectPhotoCandidates({
    images: [
      { name: 'IMG_0001.jpg', preview: 'blob:first' },
      { name: 'IMG_0001.jpg', preview: 'blob:second' }
    ]
  });
  assert.equal(photos.length, 2);
});

test('text comparison detects operational project fields beyond the title', () => {
  assert.equal(reportCategoryMatches(report, { ...report, orderNumber: 'A-101' }).text, false);
  assert.equal(reportCategoryMatches(report, { ...report, insurance: 'Andere Versicherung' }).text, false);
  assert.equal(reportCategoryMatches(report, { ...report, status: 'Abgeschlossen' }).text, false);
  assert.equal(reportCategoryMatches({ ...report, type: 'Wasserschaden' }, { ...report, type: 'Brandschaden' }).text, false);
});

test('server editing metadata and the derived address do not prevent an otherwise exact text readback', () => {
  const remote = {
    ...report,
    address: 'Neu abgeleitete Strasse 1, 8000 Zürich',
    last_edited_by: 'admin@example.ch',
    last_edited_device: 'Desktop',
    last_edited_client_id: 'browser-1',
    last_edited_at: '2026-08-20T12:00:00.000Z',
    date: '2026-08-20T12:00:00.000Z'
  };
  assert.equal(reportCategoryMatches(report, remote).text, true);
});

test('an exterior photo is part of the photo safety total and requires Storage evidence', () => {
  const withExterior = {
    ...report,
    exteriorPhoto: 'https://example.supabase.co/storage/v1/object/public/case-files/report-1/Fotos/exterior.jpg'
  };
  const photos = getProjectPhotoCandidates(withExterior);
  assert.equal(photos.length, 3);
  const summary = getProjectSyncSummary(withExterior, { verifiedPhotoKeys: ['photo-1', 'photo-2'] });
  assert.equal(summary.rows[0].text, 'Fotos: 2 von 3 synchronisiert');
});

test('storage path normalization accepts raw and public object URLs', () => {
  assert.equal(storagePathFor({ storagePath: '/report-1/Fotos/a.jpg' }), 'report-1/Fotos/a.jpg');
  assert.equal(
    storagePathFor({ supabasePath: 'https://example.supabase.co/storage/v1/object/public/case-files/report-1/Fotos/a%20b.jpg' }),
    'report-1/Fotos/a b.jpg'
  );
  assert.equal(storagePathFor({ url: 'https://unrelated.invalid/a.jpg' }), null);
});

function createSupabaseMock({ remoteReport = report, listedFiles = {}, ownDevice = true, rentalDevice = true } = {}) {
  const calls = [];
  const tableResult = table => ({
    select(columns) {
      calls.push(['select', table, columns]);
      return this;
    },
    eq(column, value) {
      calls.push(['eq', table, column, value]);
      return this;
    },
    single: async () => ({ data: { id: report.id, report_data: remoteReport }, error: null }),
    maybeSingle: async () => {
      if (table === 'devices') return { data: ownDevice ? { id: 'device-1', current_report_id: report.id } : null, error: null };
      if (table === 'rental_devices') return { data: rentalDevice ? { id: 'rental-1', report_id: report.id, end_date: null } : null, error: null };
      return { data: null, error: null };
    }
  });
  return {
    calls,
    from(table) {
      calls.push(['from', table]);
      return tableResult(table);
    },
    storage: {
      from(bucket) {
        calls.push(['storage.from', bucket]);
        return {
          async list(folder, options) {
            calls.push(['list', folder, options]);
            return { data: listedFiles[folder] || [], error: null };
          }
        };
      }
    }
  };
}

test('verification reads the report, Storage and both device tables before reporting complete evidence', async () => {
  const supabase = createSupabaseMock({
    listedFiles: {
      'report-1/Fotos': [
        { id: 'object-a', name: 'a.jpg' },
        { id: 'object-b', name: 'b.jpg' }
      ]
    }
  });
  const evidence = await verifyProjectSupabaseSync({ supabase, report });
  assert.deepEqual(evidence.verifiedPhotoKeys, ['photo-1', 'photo-2']);
  assert.deepEqual(evidence.verifiedDeviceKeys, ['local-device-1', 'local-rental-1']);
  assert.equal(evidence.textVerified, true);
  assert.equal(evidence.protocolsVerified, true);
  assert.ok(supabase.calls.some(call => call[0] === 'from' && call[1] === 'damage_reports'));
  assert.ok(supabase.calls.some(call => call[0] === 'storage.from' && call[1] === 'case-files'));
  assert.ok(supabase.calls.some(call => call[0] === 'from' && call[1] === 'devices'));
  assert.ok(supabase.calls.some(call => call[0] === 'from' && call[1] === 'rental_devices'));
});

test('Storage listing without a durable object id does not count as uploaded', async () => {
  const supabase = createSupabaseMock({
    listedFiles: { 'report-1/Fotos': [{ name: 'a.jpg' }, { name: 'b.jpg' }] }
  });
  const evidence = await verifyProjectSupabaseSync({ supabase, report });
  assert.deepEqual(evidence.verifiedPhotoKeys, []);
});

test('periodic verification preserves the last evidence while refreshing instead of blinking empty', () => {
  const source = readFileSync(new URL('../src/components/ProjectSyncControlBox.jsx', import.meta.url), 'utf8');
  assert.match(source, /const verify = async \(\{ clearEvidence = false \} = \{\}\)/);
  assert.match(source, /if \(clearEvidence\) setTargets\(\{ supabase: emptyTarget\(\), oneDrive: emptyTarget\(\) \}\)/);
  assert.match(source, /setInterval\(verify, 15000\)/);
});

const graphResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body
});

function createGraphMock({ remoteReport = report, missingPhotoIds = [], emptyProjectFile = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push([url, options]);
    if (url.includes('/root:/QTool/') && url.includes('Projektdaten.json')) {
      return graphResponse(200, {
        id: 'project-json-id', name: 'Projektdaten.json', size: emptyProjectFile ? 0 : 100,
        file: { mimeType: 'application/json' }, parentReference: { driveId: 'drive-1' }
      });
    }
    if (url.includes('/items/project-json-id/content')) return graphResponse(200, remoteReport);
    const photoId = url.match(/\/items\/([^?]+)/)?.[1];
    if (photoId) {
      if (missingPhotoIds.includes(photoId)) return graphResponse(404, { error: { message: 'missing' } });
      const photo = report.images.find(item => item.oneDriveItemId === photoId);
      return graphResponse(200, {
        id: photoId, name: photo?.name || 'unknown.jpg', size: 20,
        file: { mimeType: 'image/jpeg' }, parentReference: { driveId: 'drive-1' }
      });
    }
    throw new Error(`Unexpected Graph URL: ${url}`);
  };
  return { calls, fetchImpl };
}

test('OneDrive locators alone are never evidence; every green photo needs a fresh Graph readback', async () => {
  const oneDriveReport = {
    ...report,
    images: report.images.map((item, index) => ({ ...item, oneDriveItemId: `od-${index + 1}` }))
  };
  const graph = createGraphMock({ remoteReport: oneDriveReport, missingPhotoIds: ['od-2'] });
  const evidence = await verifyProjectOneDriveSync({
    report: oneDriveReport, tokenProvider: async () => 'token', fetchImpl: graph.fetchImpl
  });
  assert.deepEqual(evidence.verifiedPhotoKeys, ['photo-1']);
  assert.ok(graph.calls.some(([url]) => url.includes('/items/od-1?')));
  assert.ok(graph.calls.some(([url]) => url.includes('/items/od-2?')));
});

test('OneDrive verification reads non-empty project JSON and compares its actual category content', async () => {
  const oneDriveReport = {
    ...report,
    images: report.images.map((item, index) => ({ ...item, oneDriveItemId: `od-${index + 1}` }))
  };
  const good = createGraphMock({ remoteReport: oneDriveReport });
  const evidence = await verifyProjectOneDriveSync({
    report: oneDriveReport, tokenProvider: async () => 'token', fetchImpl: good.fetchImpl
  });
  assert.deepEqual(evidence.verifiedPhotoKeys, ['photo-1', 'photo-2']);
  assert.deepEqual(evidence.verifiedDeviceKeys, ['local-device-1', 'local-rental-1']);
  assert.equal(evidence.textVerified, true);
  assert.equal(evidence.protocolsVerified, true);
  assert.ok(good.calls.some(([url]) => url.includes('/items/project-json-id/content')));

  const stale = createGraphMock({ remoteReport: { ...oneDriveReport, orderNumber: 'STALE' } });
  const staleEvidence = await verifyProjectOneDriveSync({
    report: oneDriveReport, tokenProvider: async () => 'token', fetchImpl: stale.fetchImpl
  });
  assert.equal(staleEvidence.textVerified, false);
});

test('missing silent OneDrive auth fails closed before any Graph request', async () => {
  let fetched = false;
  await assert.rejects(
    verifyProjectOneDriveSync({
      report,
      tokenProvider: async () => null,
      fetchImpl: async () => { fetched = true; throw new Error('must not fetch'); }
    }),
    /stille Prüfung ausstehend/
  );
  assert.equal(fetched, false);
});

test('control box separates providers and global green requires both complete', () => {
  const source = readFileSync(new URL('../src/components/ProjectSyncControlBox.jsx', import.meta.url), 'utf8');
  assert.match(source, /verifyProjectSupabaseSync/);
  assert.match(source, /verifyProjectOneDriveSync/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /targetComplete\('supabase'\) && targetComplete\('oneDrive'\)/);
  assert.match(source, /Supabase \{row\.synced\}\/\{row\.total\}/);
  assert.match(source, /OneDrive \{oneDriveRow\.synced\}\/\{oneDriveRow\.total\}/);

  const authSource = readFileSync(new URL('../src/lib/onedrive/auth.js', import.meta.url), 'utf8');
  const silentFunction = authSource.slice(authSource.indexOf('export async function getGraphAccessTokenSilent'));
  assert.doesNotMatch(silentFunction, /acquireTokenPopup|loginPopup|loginRedirect/);
});
