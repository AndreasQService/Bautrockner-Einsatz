import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeProjectForOffline } from '../src/lib/offline/projectMaterializer.js';
import { countProjectContent } from '../src/lib/offline/projectSessionStore.js';

const rows = {
  damage_report_rooms: [{ id: 'r1', report_id: 'p1' }],
  room_measurements: [{ id: 'm1', report_id: 'p1', room_id: 'r1' }],
  measurement_protocols: [{ id: 'pr1', report_id: 'p1', storage_path: 'cases/p1/protocol.pdf' }],
  project_todos: [{ id: 't1', project_id: 'p1' }],
  devices: [{ id: 'd1', current_report_id: 'p1' }],
  case_documents: [{ id: 'doc1', case_id: 'p1', file_path: 'cases/p1/doc.pdf' }],
  project_image_uploads: [{ id: 'u1', project_id: 'p1', local_image_id: 'img1', storage_path: 'cases/p1/img.jpg' }],
  project_status_history: [{ id: 'h1', project_id: 'p1', status: 'Schadenaufnahme' }],
  project_tasks: [{ id: 'pt1', project_id: 'p1', title: 'Kontakt' }],
  rental_devices: [{ id: 'rd1', report_id: 'p1', device_number: 'd1' }],
  case_extractions: [{ id: 'ce1', case_id: 'p1', document_id: 'doc1' }],
};

function mockSupabase(failingTable = null) {
  return { from(table) {
    const result = failingTable === table ? { data: null, error: new Error('offline table failure') } : { data: rows[table], error: null };
    const chain = { select: () => chain, eq: () => chain, is: () => Promise.resolve(result), then: (ok, bad) => Promise.resolve(result).then(ok, bad) };
    return chain;
  } };
}

test('materializer loads every required relational entity and storage-only artifact', async () => {
  const project = await materializeProjectForOffline(mockSupabase(), { id: 'p1', description: 'local source' });
  assert.equal(project._offlineMaterialization.relationalRooms.length, 1);
  assert.equal(project._offlineMaterialization.relationalMeasurements.length, 1);
  assert.equal(project._offlineMaterialization.relationalProtocols.length, 1);
  assert.equal(project.projectTodos[0].id, 't1');
  assert.equal(project.devices[0].id, 'd1');
  assert.equal(project.projectStatusHistory[0].id, 'h1');
  assert.equal(project.projectTasks[0].id, 'pt1');
  assert.equal(project.rentalDevices[0].id, 'rd1');
  assert.equal(project.caseExtractions[0].id, 'ce1');
  assert.deepEqual(project._offlineMaterialization.authoritativeSources, [
    'damage_report_rooms', 'room_measurements', 'measurement_protocols',
    'project_todos', 'devices', 'case_documents', 'project_image_uploads',
    'project_status_history', 'project_tasks', 'rental_devices', 'case_extractions',
  ]);
  assert.deepEqual(project._offlineMaterialization.storageArtifacts.map(x => x.entityId).sort(), ['doc1', 'img1', 'pr1']);
  assert.deepEqual(countProjectContent(project), {
    projects: 1, rooms: 1, measurementRooms: 0, measurementProtocols: 1,
    measurements: 1, images: 0, equipment: 1, todos: 1, contacts: 0,
    documents: 1, uploadJournal: 1, storageArtifacts: 3,
  });
});

test('materializer fails closed if any required table cannot be loaded', async () => {
  await assert.rejects(materializeProjectForOffline(mockSupabase('room_measurements'), { id: 'p1' }), /Messwerte.*failure/);
});

test('materializer fails closed for every authoritative auxiliary source', async () => {
  for (const [table, label] of [
    ['project_status_history', 'Statushistorie'],
    ['project_tasks', 'Projektaufgaben'],
    ['rental_devices', 'Mietgeräte'],
    ['case_extractions', 'Dokumentextraktionen'],
  ]) {
    await assert.rejects(materializeProjectForOffline(mockSupabase(table), { id: 'p1' }), new RegExp(`${label}.*failure`));
  }
});

test('materializer keeps HTTP protocol/document/journal variants as required downloads', async () => {
  const variantRows = structuredClone(rows);
  variantRows.measurement_protocols[0] = { id: 'pr1', report_id: 'p1', file_url: 'https://test.invalid/protocol.pdf' };
  variantRows.case_documents[0] = { id: 'doc1', case_id: 'p1', public_url: 'https://test.invalid/doc.pdf' };
  variantRows.project_image_uploads[0] = { id: 'u1', project_id: 'p1', local_image_id: 'img1', signed_url: 'https://test.invalid/image.jpg' };
  const supabase = { from(table) {
    const result = { data: variantRows[table], error: null };
    const chain = { select: () => chain, eq: () => chain, is: () => Promise.resolve(result), then: (ok, bad) => Promise.resolve(result).then(ok, bad) };
    return chain;
  } };
  const project = await materializeProjectForOffline(supabase, { id: 'p1' });
  assert.deepEqual(project._offlineMaterialization.storageArtifacts.map(x => x.url).sort(), [
    'https://test.invalid/doc.pdf', 'https://test.invalid/image.jpg', 'https://test.invalid/protocol.pdf',
  ]);
});

test('upload journal artifact without any retrievable source fails closed', async () => {
  const bad = structuredClone(rows);
  bad.project_image_uploads[0] = { id: 'u1', project_id: 'p1', local_image_id: 'img1' };
  const supabase = { from(table) {
    const result = { data: bad[table], error: null };
    const chain = { select: () => chain, eq: () => chain, is: () => Promise.resolve(result), then: (ok, badHandler) => Promise.resolve(result).then(ok, badHandler) };
    return chain;
  } };
  await assert.rejects(materializeProjectForOffline(supabase, { id: 'p1' }), /weder Storage-Pfad noch Download-URL/);
});
