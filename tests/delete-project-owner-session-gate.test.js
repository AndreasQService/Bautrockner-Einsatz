import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../supabase/functions/delete-project/index.ts', import.meta.url), 'utf8');

test('delete edge request requires exact header/body project and owner token', () => {
  assert.match(source, /x-qtool-session-token/);
  assert.match(source, /x-qtool-project-id/);
  assert.match(source, /headerProjectId !== projectId/);
  assert.match(source, /sessionToken\.length < 20/);
  assert.match(source, /\.eq\('open_project_id', projectId\)[\s\S]*\.eq\('session_token', sessionToken\)[\s\S]*\.eq\('owner_user_id', actorUid\)/);
  assert.match(source, /PROJECT_LOCK_NOT_OWNED/);
});

test('owner evidence is audited before destructive service-role RPC', () => {
  const audit = source.indexOf("from('qtool_privileged_mutation_audit').insert");
  const rpc = source.indexOf("rpc('delete_project_secure'");
  assert.ok(audit > 0 && rpc > audit);
  assert.match(source, /correlation_id: correlationId/);
  assert.match(source, /owner_session_verified: true/);
});
