import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { excludeLockedProjectItems } from '../supabase/functions/_shared/lockedProjectFilter.js';

const sync = await readFile(new URL('../supabase/functions/onedrive-sync/index.ts', import.meta.url), 'utf8');
const upload = await readFile(new URL('../supabase/functions/onedrive-upload-worker/index.ts', import.meta.url), 'utf8');

test('legacy global OneDrive sync is retired and cannot write QTool root', () => {
  assert.match(sync, /LEGACY_ONEDRIVE_SYNC_RETIRED/);
  assert.match(sync, /status: 410/);
  assert.doesNotMatch(sync, /ROOT_FOLDER\s*=\s*['"]QTool['"]/);
  assert.doesNotMatch(sync, /from\(['"]onedrive_sync_queue['"]\)/);
});

test('trusted background upload worker excludes every actively locked project', () => {
  assert.match(upload, /if \(isWorker && items\.length > 0\)/);
  assert.match(upload, /from\('project_sessions'\)[\s\S]*\.in\('open_project_id', projectIds\)/);
  assert.match(upload, /items = excludeLockedProjectItems\(items, activeLocks \|\| \[\]\)/);
  assert.ok(upload.indexOf('items = excludeLockedProjectItems') < upload.indexOf('for (const item of items)'));
});

test('locked-project filter behavior defers locked rows and keeps unlocked rows', () => {
  const items = [{ id: 'a', project_id: 'locked' }, { id: 'b', project_id: 'free' }];
  assert.deepEqual(excludeLockedProjectItems(items, [{ open_project_id: 'locked' }]), [{ id: 'b', project_id: 'free' }]);
  assert.deepEqual(excludeLockedProjectItems(items, []), items);
});

test('browser upload worker validates JWT owner token and scopes queue to exact project', () => {
  assert.match(upload, /auth\.getUser\(jwt\)/);
  assert.match(upload, /x-qtool-session-token/);
  assert.match(upload, /x-qtool-project-id/);
  assert.match(upload, /\.eq\('open_project_id', scopedProjectId\)[\s\S]*\.eq\('session_token', sessionToken\)[\s\S]*\.eq\('owner_user_id', authData\.user\.id\)/);
  assert.match(upload, /pendingQuery = pendingQuery\.eq\('project_id', scopedProjectId\)/);
  const handler = upload.slice(upload.indexOf('Deno.serve'));
  assert.ok(handler.indexOf('Project lock not owned') < handler.indexOf("from('project_image_uploads')"));
});
