import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  getProjectPhotoEvidenceKey,
  getProjectPhotoCandidates,
  getProjectSyncSummary,
  reportCategoryMatches
} from '../src/lib/projectSyncSummary.js';
import {
  storagePathFor,
  verifyProjectSupabaseSync
} from '../src/lib/verifyProjectSupabaseSync.js';
import { verifyProjectOneDriveSync } from '../src/lib/verifyProjectOneDriveSync.js';
import { hasSupplierInvoice } from '../src/features/projects/invoiceEvidence.js';

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

test('gallery photo status resolves only to the exact verifier evidence key', () => {
  assert.equal(getProjectPhotoEvidenceKey(report, { ...report.images[0] }), 'photo-1');
  assert.equal(getProjectPhotoEvidenceKey(report, { ...report.images[1] }), 'photo-2');
  assert.equal(getProjectPhotoEvidenceKey(report, { name: 'not-in-report.jpg' }), null);
});

test('ambiguous photo metadata fails closed instead of showing a fake green status', () => {
  const ambiguous = {
    images: [
      { name: 'same.jpg', date: '2026-08-21', size: 100 },
      { name: 'same.jpg', date: '2026-08-21', size: 100 }
    ]
  };
  assert.equal(getProjectPhotoEvidenceKey(ambiguous, { name: 'same.jpg', date: '2026-08-21', size: 100 }), null);
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

test('technical report_data wrapper is ignored but real edits still require a fresh readback', () => {
  const local = {
    ...report,
    cause: 'Leckage',
    report_data: {
      projectTitle: 'Veralteter Wrapper',
      cause: 'Veralteter Wrapper'
    }
  };
  const remote = { ...report, cause: 'Leckage' };

  assert.equal(reportCategoryMatches(local, remote).text, true);
  assert.equal(reportCategoryMatches({ ...local, cause: 'Neue Ursache' }, remote).text, false);
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
  assert.match(source, /setInterval\(verify, 60000\)/);
});

test('gallery badges consume fresh verifier evidence and never trust local upload flags', () => {
  const form = readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  const start = form.indexOf('{/* DB Sync Status Badge */}');
  const end = form.indexOf('<button', start);
  assert.ok(start >= 0 && end > start);
  const badge = form.slice(start, end);
  assert.match(badge, /verifiedPhotoEvidence\.supabase\.includes\(evidenceKey\)/);
  assert.match(badge, /verifiedPhotoEvidence\.oneDrive\.includes\(evidenceKey\)/);
  assert.doesNotMatch(badge, /img\.syncStatus === 'uploaded_to_backend'/);
  assert.doesNotMatch(badge, /img\.supabasePath \|\|\s*img\.oneDriveItemId/);
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

test('missing OneDrive project JSON does not suppress independent photo evidence', async () => {
  const oneDriveReport = {
    ...report,
    images: report.images.map((item, index) => ({ ...item, oneDriveItemId: `od-${index + 1}` }))
  };
  const fetchImpl = async url => {
    if (url.includes('/Projektdaten.json:')) return { ok: false, status: 404, json: async () => ({}) };
    if (url.includes('/items/od-1?')) return { ok: true, status: 200, json: async () => ({ id: 'od-1', name: oneDriveReport.images[0].name, size: 10, file: {} }) };
    if (url.includes('/items/od-2?')) return { ok: true, status: 200, json: async () => ({ id: 'od-2', name: oneDriveReport.images[1].name, size: 10, file: {} }) };
    throw new Error(`Unexpected URL ${url}`);
  };
  const evidence = await verifyProjectOneDriveSync({
    report: oneDriveReport,
    tokenProvider: async () => 'token',
    fetchImpl
  });
  assert.deepEqual(evidence.verifiedPhotoKeys, ['photo-1', 'photo-2']);
  assert.equal(evidence.textVerified, false);
  assert.equal(evidence.protocolsVerified, false);
});

test('control box separates providers and global green requires both complete', () => {
  const source = readFileSync(new URL('../src/components/ProjectSyncControlBox.jsx', import.meta.url), 'utf8');
  assert.match(source, /verifyProjectSupabaseSync/);
  assert.match(source, /verifyProjectOneDriveSync/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /const cloudsComplete = targetComplete\('supabase'\) && targetComplete\('oneDrive'\)/);
  assert.match(source, /const green = localSaveConfirmed && cloudsComplete/);
  assert.match(source, /Cloud-Prüfung wartet auf Speicherung des aktuellen Stands/);
  assert.match(source, /\{localSaveConfirmed && <div/);
  assert.doesNotMatch(source, /Cloud-Nachweis gilt für den letzten gespeicherten Stand/);
  assert.match(source, /Supabase \{row\.synced\}\/\{row\.total\}/);
  assert.match(source, /OneDrive \{oneDriveRow\.synced\}\/\{oneDriveRow\.total\}/);

  const authSource = readFileSync(new URL('../src/lib/onedrive/auth.js', import.meta.url), 'utf8');
  const silentFunction = authSource.slice(authSource.indexOf('export async function getGraphAccessTokenSilent'));
  assert.doesNotMatch(silentFunction, /acquireTokenPopup|loginPopup|loginRedirect/);
});

test('control box is the bottom-most single-line status bar', () => {
  const source = readFileSync(new URL('../src/components/ProjectSyncControlBox.jsx', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  assert.match(source, /left: 0, right: 0, bottom: 0, zIndex: 101/);
  assert.match(source, /minWidth: 'max-content', whiteSpace: 'nowrap'/);
  assert.match(source, /overflowX: 'auto', overflowY: 'hidden'/);
  assert.match(source, /\{row\.label\}:/);
  assert.doesNotMatch(source, /gridTemplateColumns: 'repeat\(2/);
  assert.match(form, /bottom: '38px'/);
});

test('fixed save footer is status-only because autosave owns persistence', () => {
  const form = readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  const footerStart = form.indexOf('Mobile / Technician Fixed Footer - AutoSave Version');
  const footerEnd = form.indexOf('<ImageEditor', footerStart);
  const footer = form.slice(footerStart, footerEnd);
  assert.doesNotMatch(footer, /onClick=\{handleSubmit\}/);
  assert.doesNotMatch(footer, />Fertig</);
  assert.match(form, /}, 300\); \/\/ Short debounce/);
  assert.match(form, /'project-exit'/);
  assert.doesNotMatch(footer, /onClick=\{onCancel\}/);
  assert.doesNotMatch(footer, /handleArchiveProject|handleDeleteProject|Projekt archivieren|Projekt löschen/);
});

test('edited photos keep the same durable id from ImageEditor through project sync', () => {
  const editor = readFileSync(new URL('../src/components/ImageEditor.jsx', import.meta.url), 'utf8');
  const form = readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  assert.match(editor, /savePhotoLocally\(editedPhotoId/);
  assert.match(editor, /onSave\(dataUrl, localDescription, \{ id: editedPhotoId, blob: editedBlob \}\)/);
  assert.match(form, /id: editedFile\?\.id/);
  assert.doesNotMatch(form, /id: `edited_\$\{Date\.now\(\)\}/);
  assert.match(form, /if \(isSyncingRef\.current\) return/);
  assert.doesNotMatch(form, /\[formData\.id, formData\.projectNumber, isSyncing, supabase\]/);
});

test('OneDrive folder creation checks existence and deduplicates concurrent requests', () => {
  const service = readFileSync(new URL('../src/services/OneDriveService.js', import.meta.url), 'utf8');
  assert.match(service, /const confirmedFolders = new Set\(\)/);
  assert.match(service, /const folderChecksInFlight = new Map\(\)/);
  assert.match(service, /if \(folderChecksInFlight\.has\(fullPath\)\) return folderChecksInFlight\.get\(fullPath\)/);
  assert.match(service, /\?\$select=id,folder/);
  assert.match(service, /if \(existing\.ok\)/);
  assert.match(service, /if \(existing\.status !== 404\)/);
});

test('form autosave waits for and returns the actual Supabase confirmation', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /handleSaveReport = useCallback\(async \(updatedReport, silent = false, saveReason = null\)/);
  assert.match(app, /saveReason === 'user-edit' \|\| saveReason === 'project-exit'/);
  assert.match(app, /saveConfirmation = await enqueueCloudSave\(\)/);
  assert.match(app, /return saveConfirmation \|\| \{/);
});

test('autosave coalesces rerenders and edits while a cloud save is in flight', () => {
  const form = readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  assert.match(form, /const autosaveInFlightRef = useRef\(false\)/);
  assert.match(form, /if \(autosaveInFlightRef\.current\) return/);
  assert.match(form, /const newerEditPending = hasSemanticChanges\(formData, latestFormData\.current\)/);
  assert.match(form, /autosaveInFlightRef\.current = false/);
});

test('save footer requires both cloud readbacks and OneDrive backfill retries missing photos', () => {
  const form = readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  const control = readFileSync(new URL('../src/components/ProjectSyncControlBox.jsx', import.meta.url), 'utf8');
  assert.match(control, /cloudsComplete:/);
  assert.match(form, /const saveConfirmed = localSaveConfirmed && cloudSyncComplete/);
  assert.match(form, /Cloud-Synchronisierung ausstehend/);
  assert.match(form, /Math\.min\(3, queue\.length\)/);
  assert.match(form, /const oneDriveBackfillSignature = getProjectPhotoCandidates\(formData\)/);
  assert.match(form, /exteriorPhotoOneDriveItemId: oneDriveUpdate\.oneDriveItemId/);
  assert.match(form, /oneDriveBackfillRetryTick/);
  assert.match(form, /useRef\(new globalThis\.Map\(\)\)/);
  assert.doesNotMatch(form, /oneDriveBackfillRetryRef = useRef\(new Map\(\)\)/);
  assert.match(form, /\[1500, 3000, 6000, 12000, 30000\]/);
});

test('open project counts and uploads only its own pending photos', () => {
  const form = readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  const storage = readFileSync(new URL('../src/services/PhotoStorage.js', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../src/lib/sync/supabaseSyncWorker.js', import.meta.url), 'utf8');
  assert.match(form, /getPendingCount\(formData\.id \|\| 'temp'\)/);
  assert.match(form, /syncPendingToSupabase\(formData\.id \|\| 'temp'\)/);
  assert.match(storage, /export async function getPendingCount\(projectId = null\)/);
  assert.match(worker, /export async function syncPendingToSupabase\(projectId = null\)/);
  assert.match(worker, /if \(projectId && p\.projectId !== projectId\) return false/);
});

test('damage photo deletion removes the durable IndexedDB row before form state', () => {
  const form = readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  const storage = readFileSync(new URL('../src/services/PhotoStorage.js', import.meta.url), 'utf8');
  assert.match(storage, /export async function deletePhotoLocally\(photoId\)/);
  assert.match(storage, /objectStore\(STORE_PHOTOS\)\.delete\(photoId\)/);
  assert.match(form, /await deletePhotoLocally\(img\.id\)/);
});

test('cloud verification rechecks OneDrive project JSON promptly without overlapping requests', () => {
  const source = readFileSync(new URL('../src/components/ProjectSyncControlBox.jsx', import.meta.url), 'utf8');
  assert.match(source, /let verificationInFlight = false/);
  assert.match(source, /if \(verificationInFlight\) return/);
  assert.match(source, /setTimeout\(\(\) => verify\(\{ clearEvidence: false \}\), 2000\)/);
  assert.match(source, /setTimeout\(\(\) => verify\(\{ clearEvidence: false \}\), 6000\)/);
});

test('autosave baseline uses the form shape and cannot loop on derived cloud fields', () => {
  const form = readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  const matches = form.match(/lastSavedData\.current = JSON\.parse\(JSON\.stringify\(formData\)\)/g) || [];
  assert.ok(matches.length >= 2);
  assert.doesNotMatch(form, /lastSavedData\.current = JSON\.parse\(JSON\.stringify\(reportData\)\)/);
});

test('invoice evidence requires an actual file in the explicit invoice category', () => {
  assert.equal(hasSupplierInvoice({ images: [] }), false);
  assert.equal(hasSupplierInvoice({ images: [{ id: 'misc', name: 'foto.jpg', assignedTo: 'Sonstiges' }] }), false);
  assert.equal(hasSupplierInvoice({ images: [{ id: 'empty', assignedTo: 'Lieferantenrechnungen' }] }), false);
  assert.equal(hasSupplierInvoice({ images: [{ id: 'inv', name: 'rechnung.pdf', assignedTo: 'Lieferantenrechnungen' }] }), true);
  assert.equal(hasSupplierInvoice({ images: [{ id: 'deleted', name: 'rechnung.pdf', assignedTo: 'Lieferantenrechnungen', deleted: true }] }), false);
});
