import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { countProjectContent, collectProjectMediaUrls } from '../src/lib/offline/projectSessionStore.js';

test('project content summary reports user-facing business counts', () => {
  assert.deepEqual(countProjectContent({
    rooms: [{ id: 'r1' }, { id: 'r2' }],
    measurementRooms: [{ measurements: [{}, {}] }],
    measurementProtocols: [{ measurements: [{}] }],
    images: [{ url: 'https://example.test/a.jpg' }],
    exteriorPhoto: 'https://example.test/e.jpg',
    equipment: [{}, {}], todos: [{}], contacts: [{}, {}],
  }), {
    projects: 1, rooms: 2, measurementRooms: 1, measurementProtocols: 1,
    measurements: 3, images: 2, equipment: 2, todos: 1, contacts: 2,
    documents: 0, uploadJournal: 0, storageArtifacts: 0,
  });
});

test('project media URL collection is stable and deduplicated', () => {
  assert.deepEqual(collectProjectMediaUrls({
    exteriorPhoto: 'https://example.test/a.jpg',
    images: [{ url: 'https://example.test/a.jpg' }, { preview: 'blob:local' }],
    measurementRooms: [{ images: [{ publicUrl: 'https://example.test/m.jpg' }] }],
  }), ['https://example.test/a.jpg', 'https://example.test/m.jpg']);
});

test('App fails closed before form and exposes verified offline banner', () => {
  const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /Projekt kann nur mit Internetverbindung geöffnet werden/);
  assert.match(source, /acquire_project_lock/);
  assert.match(source, /lockResult\?\.acquired !== true/);
  assert.match(source, /createVerifiedProjectSession/);
  const panel = fs.readFileSync(new URL('../src/components/ProjectSessionSyncPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /Projekt offline verfügbar/);
  assert.match(source, /projectExitSyncRef\.current/);
});

test('background outbox is paused for an active project session', () => {
  const source = fs.readFileSync(new URL('../src/lib/offline/outboxWorker.js', import.meta.url), 'utf8');
  assert.match(source, /hasActiveProjectSession/);
  assert.match(source, /skipped: 'active_project_session'/);
  assert.match(source, /reason === 'project_exit'/);
});

test('session snapshot cannot silently add media without a durable blob', () => {
  const source = fs.readFileSync(new URL('../src/lib/offline/projectSessionStore.js', import.meta.url), 'utf8');
  assert.match(source, /Neue Bilddatei muss atomar über die zentrale Medien-Outbox gespeichert werden/);
  assert.match(source, /mediaBlobIds \|\| \[\]\)\.length !== expectedMediaCount/);
  assert.match(source, /expectedStorageArtifacts/);
  assert.match(source, /Lokale Bildzuordnung ist unvollständig/);
});

test('unfinished local work is never replaced by a different cloud base', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /recoverable && Number\(recoverable\.baseVersion\) !== baseVersion/);
  assert.match(app, /LOCAL_SESSION_CLOUD_VERSION_CONFLICT/);
  assert.match(app, /Lokale Daten bleiben erhalten/);
  assert.doesNotMatch(app, /if \(recoverable && Number\(recoverable\.baseVersion\) === baseVersion\)/);
});

test('stale async snapshot completion cannot overwrite a newer local revision', () => {
  const store = fs.readFileSync(new URL('../src/lib/offline/projectSessionStore.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(store, /incomingRevision <= storedRevision/);
  assert.match(store, /staleWriteRejected: true/);
  assert.match(app, /issueLocalRevision/);
  assert.match(app, /updateProjectSessionSnapshot\(projectId, snapshot, \{ localRevision \}\)/);
});

test('sync evidence does not disable crash recovery before navigation succeeds', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const store = fs.readFileSync(new URL('../src/lib/offline/projectSessionStore.js', import.meta.url), 'utf8');
  const staged = app.indexOf('await stageProjectSessionConfirmation(projectId, readiness.evidence)');
  const action = app.indexOf('const actionResult = await action()', staged);
  const closed = app.indexOf('if (projectStillOpen)', action);
  const confirmed = app.indexOf('await confirmProjectSession(projectId, readiness.evidence)', closed);
  const released = app.indexOf('await releaseProjectLock(projectId)', closed);
  assert.ok(staged >= 0 && staged < action);
  assert.ok(action < closed && closed < released && released < confirmed);
  assert.match(store, /row\.state = 'fully_confirmed'/);
  assert.doesNotMatch(store.match(/export async function stageProjectSessionConfirmation[\s\S]*?\n\}/)?.[0] || '', /fully_confirmed/);
});
