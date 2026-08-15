import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareProjectSyncContent,
  compareProjectReportData,
  countProjectSyncContent,
  formatProjectSyncCounts,
} from '../src/lib/offline/projectSyncSummary.js';

const project = () => ({
  id: 'project-1',
  rooms: [
    { id: 'r1', measurementData: { measurements: [{ value: 20 }, { value: 21 }] } },
    { id: 'r2' },
  ],
  measurementRooms: [
    { id: 'r1', measurementData: { measurements: [{ value: 20 }, { value: 21 }] } },
  ],
  images: [
    { id: 'i1', storagePath: 'project/i1.jpg' },
    { id: 'i2', preview: 'data:image/jpeg;base64,AA==' },
  ],
  equipment: [{ id: 'd1' }],
  todos: [{ id: 't1' }],
  pdfs: [{ name: 'Messprotokoll.pdf' }],
});

test('counts fachliche Inhalte ohne doppelte Räume', () => {
  assert.deepEqual(countProjectSyncContent(project()), {
    projects: 1,
    rooms: 2,
    measurementProtocols: 1,
    measurementValues: 2,
    images: 2,
    deviceChanges: 1,
    todos: 1,
    pdfs: 1,
  });
});

test('count mismatch blocks a truthful completion summary', () => {
  const cloud = project();
  cloud.images = cloud.images.slice(0, 1);
  const comparison = compareProjectSyncContent(project(), cloud);
  assert.equal(comparison.verified, false);
  assert.ok(comparison.mismatches.includes('images'));
  assert.ok(comparison.mismatches.some(path => path.startsWith('$.images')));
});

test('same counts never hide stale text, measurement values or media hashes', () => {
  const local = project();
  local.description = 'Neue Feststellung';
  local.version = 12;
  local.images[0].sha256 = 'sha-new';
  local.images[0].size = 1234;
  local.rooms[0].measurementData.measurements[0] = { id: 'm1', value: 99, deleted_at: null };

  const cloud = structuredClone(local);
  cloud.description = 'Alte Feststellung';
  cloud.images[0].sha256 = 'sha-old';
  cloud.rooms[0].measurementData.measurements[0].value = 20;

  const comparison = compareProjectSyncContent(local, cloud);
  assert.equal(comparison.expected.images, comparison.confirmed.images);
  assert.equal(comparison.expected.measurementValues, comparison.confirmed.measurementValues);
  assert.equal(comparison.verified, false);
  assert.ok(comparison.mismatches.some(path => path.endsWith('.description')));
  assert.ok(comparison.mismatches.some(path => path.endsWith('.sha256')));
  assert.ok(comparison.mismatches.some(path => path.endsWith('.value')));
});

test('versions, ids and tombstones must match exactly', () => {
  const local = project();
  local.version = 7;
  local.rooms[0].deleted_at = '2026-08-14T12:00:00.000Z';
  const cloud = structuredClone(local);
  cloud.version = 6;
  cloud.rooms[0].id = 'wrong-room';
  cloud.rooms[0].deleted_at = null;
  const comparison = compareProjectSyncContent(local, cloud);
  assert.equal(comparison.verified, false);
  assert.ok(comparison.mismatches.some(path => path.endsWith('.version')));
  assert.ok(comparison.mismatches.some(path => path.includes('.rooms')));
});

test('transport-only timestamps and preview URLs do not create false conflicts', () => {
  const local = project();
  local.updatedAt = 'local-time';
  local.images[0].preview = 'blob:local-preview';
  const cloud = structuredClone(local);
  cloud.updatedAt = 'cloud-time';
  cloud.images[0].preview = 'https://signed.example/image.jpg?token=short-lived';
  assert.equal(compareProjectSyncContent(local, cloud).verified, true);
});

test('formats a compact user summary', () => {
  assert.deepEqual(formatProjectSyncCounts(countProjectSyncContent(project())), [
    '1 Projekt', '2 Räume', '1 Messprotokolle', '2 Messwerte', '2 Bilder',
    '1 Geräte', '1 To-dos', '1 PDF',
  ]);
});

test('report_data comparison uses current merged local fields, not a stale nested copy', () => {
  const local = { id: 'p1', text: 'neu', report_data: { text: 'alt' }, _offlineMaterialization: {} };
  assert.equal(compareProjectReportData(local, { text: 'neu' }).verified, true);
  assert.equal(compareProjectReportData(local, { text: 'alt' }).verified, false);
});

test('regression: same count with changed content must fail exact match', () => {
  const local = project();
  local.rooms[0].name = 'Badezimmer EG';
  const cloud = structuredClone(local);
  cloud.rooms[0].name = 'Badezimmer OG';

  const result = compareProjectSyncContent(local, cloud);
  assert.equal(result.expected.rooms, result.confirmed.rooms);
  assert.equal(result.verified, false);
  assert.ok(result.mismatches.some(m => m.includes('name')));
});

test('regression: volatile client envelope flags do not trigger false mismatches', () => {
  const local = project();
  local._projectMode = 'technician';
  local._last_local_mutation = '2026-08-15T10:00:00.000Z';
  local.offlineRecovered = true;
  local.offlineTransactionId = 'tx-123';

  const cloud = project();
  const result = compareProjectReportData(local, cloud);
  assert.equal(result.verified, true);
  assert.equal(result.mismatches.length, 0);
});

test('regression: anonymous/test environment session exit confirms exact content match without false positive warnings', () => {
  const local = project();
  local._is_offline_fallback = true;
  local.isLightweight = false;
  local._supabase_updated_at = '2026-08-15T18:00:00.000Z';

  const cloud = project();
  cloud.created_at = '2026-08-15T17:50:00.000Z';
  cloud.updated_at = '2026-08-15T18:00:00.000Z';

  const result = compareProjectReportData(local, cloud);
  assert.equal(result.verified, true);
  assert.equal(result.mismatches.length, 0);
});
