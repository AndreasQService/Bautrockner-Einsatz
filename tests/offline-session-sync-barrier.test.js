import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../src/lib/offline/outboxWorker.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const form = readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('background sync is fail-closed while a project session is active', () => {
  assert.match(worker, /!allowDuringProjectSession && await hasActiveProjectSession\(\)/);
  assert.match(worker, /reason === 'project_exit'/);
  assert.match(app, /triggerOfflineOutboxSync\('project_exit', \{ projectId \}\)/);
  assert.doesNotMatch(app, /Auto-triggering sync for pending draft on project open/);
  assert.doesNotMatch(app, /uploadProjectJson\(odFolder, finalSyncedReport\)\.catch/);
  assert.match(app, /if \(await hasActiveProjectSession\(\)\) return/);
  assert.match(main, /hasActiveProjectSession/);
  assert.match(form, /if \(await hasActiveProjectSession\(\)\) return/);
  assert.doesNotMatch(form, /await uploadReport\(odFolder, 'Energieprotokoll'/);
  assert.doesNotMatch(form, /await uploadExcel\(odFolder, result\.blob\)/);
});

test('strict project exit drains only the current project', () => {
  assert.match(worker, /claimPendingOperations\(\{ limit, projectId \}\)/);
  assert.match(worker, /runOfflineOutboxOnce\(\{ allowDuringProjectSession: reason === 'project_exit', projectId \}\)/);
});
