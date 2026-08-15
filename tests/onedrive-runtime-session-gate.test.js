import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('durable OneDrive API gates every mutating fetch including upload chunks', async () => {
  const source = await readFile(new URL('../src/lib/uploads/oneDriveApi.js', import.meta.url), 'utf8');
  assert.match(source, /graphFetch[\s\S]*assertOneDriveWriteAllowed\(options\.method \|\| 'GET'\)/);
  assert.match(source, /ensureFolder[\s\S]*assertOneDriveWriteAllowed\('POST'\)/);
  assert.match(source, /uploadChunk[\s\S]*assertOneDriveWriteAllowed\('PUT'\)/);
  assert.match(source, /writeManifestFile[\s\S]*assertOneDriveWriteAllowed\('PUT'\)/);
});

test('upload worker skips active sessions and supports project-scoped final drain', async () => {
  const source = await readFile(new URL('../src/lib/uploads/uploadWorker.js', import.meta.url), 'utf8');
  assert.match(source, /assertOneDriveWriteAllowed\('POST'\)/);
  assert.match(source, /skipped: 'active_project_session'/);
  assert.match(source, /projectId && String\(i\.projectId\) !== String\(projectId\)/);
});
