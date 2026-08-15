import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countProjectContent } from '../../src/lib/offline/projectSessionStore.js';

const sessionStore = readFileSync(
  new URL('../../src/lib/offline/projectSessionStore.js', import.meta.url),
  'utf8',
);
const transactionStore = readFileSync(
  new URL('../../src/lib/offline/transactionStore.js', import.meta.url),
  'utf8',
);
const domainHandlers = readFileSync(
  new URL('../../src/lib/offline/supabaseDomainHandlers.js', import.meta.url),
  'utf8',
);
const lockSql = readFileSync(
  new URL('../../supabase/migrations/20260814000000_project_write_lock_enforcement.sql', import.meta.url),
  'utf8',
);

test('P0 repro: equal counts do not prove equal texts, rooms or measurements', () => {
  const before = {
    description: 'Wasserschaden im Bad',
    rooms: [{ id: 'room-1', name: 'Bad' }],
    measurementRooms: [{ id: 'room-1', measurements: [{ id: 'm-1', value: 87 }] }],
  };
  const corrupted = {
    description: 'ALTER CLOUD-STAND',
    rooms: [{ id: 'room-1', name: 'Kueche' }],
    measurementRooms: [{ id: 'room-1', measurements: [{ id: 'm-1', value: 12 }] }],
  };

  assert.deepEqual(countProjectContent(before), countProjectContent(corrupted));
  assert.notDeepEqual(before, corrupted);
});

test('P0 gate: verified project session hashes and reads back exact canonical snapshot content', () => {
  assert.match(sessionStore, /snapshotChecksum/,
    'BLOCKER: project session has no persisted content checksum');
  assert.match(sessionStore, /sha256CanonicalProjectContent/,
    'BLOCKER: project session has no canonical project-content digest');
  assert.match(sessionStore, /Lokale Projekt-Pruefsumme stimmt nicht|Lokale Projekt-Prüfsumme stimmt nicht/,
    'BLOCKER: verifyProjectSession does not reject same-count content corruption');
});

test('P0 gate: every local mutation is read back and content-hashed before localConfirmedAt', () => {
  assert.match(transactionStore, /snapshotChecksum/,
    'BLOCKER: outbox transaction manifest does not persist an exact snapshot checksum');
  assert.match(transactionStore, /Lokaler Snapshot-Readback|Lokale Snapshot-Pruefsumme|Lokale Snapshot-Prüfsumme/,
    'BLOCKER: createOfflineTransaction resolves without exact snapshot readback');
});

test('P0 gate: measurement protocol files require hash plus OneDrive byte readback', () => {
  const handler = domainHandlers.match(/const measurementHandler = async[\s\S]*?\n {2}};/)?.[0] || '';
  assert.match(handler, /sha256/i,
    'BLOCKER: measurement protocol Storage readback is checked only by byte count');
  assert.match(handler, /OneDrive/i,
    'BLOCKER: measurement protocol is confirmed without OneDrive readback');
});

test('P0 gate: an intentionally offline editing lease cannot expire after 20 minutes', () => {
  assert.doesNotMatch(lockSql, /last_seen\s*<\s*now\(\)\s*-\s*interval\s*'20 minutes'/i,
    'BLOCKER: active offline iPad loses exclusive ownership after 20 minutes without a possible heartbeat');
});
