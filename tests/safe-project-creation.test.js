import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectAtomically } from '../src/lib/safeProjectCreation.js';
import fs from 'node:fs';

const project = { id: 'project-123', projectTitle: 'Neu', rooms: [] };
const token = 'session-token-with-at-least-twenty-characters';

function client({ createError = null, createData = { created: true, project_id: project.id }, reportError = null, lockError = null, owner = true } = {}) {
  const calls = [];
  return {
    calls,
    rpc: async (name, params) => {
      calls.push({ type: 'rpc', name, params });
      if (name === 'create_project_and_acquire_lock') return { data: createData, error: createError };
      return { data: { open_project_id: project.id, is_owner: owner }, error: lockError };
    },
    from: table => ({
      select: columns => ({
        eq: (column, value) => ({
          single: async () => {
            calls.push({ type: 'readback', table, columns, column, value });
            return { data: { id: project.id, report_data: project, updated_at: '2026-08-19T08:00:00Z' }, error: reportError };
          },
        }),
      }),
    }),
  };
}

test('creates through atomic RPC then verifies DB and lock ownership', async () => {
  const supabase = client();
  const result = await createProjectAtomically({ supabase, project, sessionToken: token, device: 'Desktop:user:Name:mail', clientId: 'client-1' });
  assert.equal(result._cloudSyncStatus, 'confirmed');
  assert.deepEqual(supabase.calls.map(call => call.name || call.type), [
    'create_project_and_acquire_lock', 'readback', 'get_project_lock_status',
  ]);
  assert.equal(supabase.calls[0].params.p_project_id, project.id);
});

test('fails closed when atomic RPC is unavailable', async () => {
  const supabase = client({ createError: { message: 'function does not exist' } });
  await assert.rejects(createProjectAtomically({ supabase, project, sessionToken: token, device: 'Desktop', clientId: 'client-1' }), /nicht bestätigt/);
  assert.equal(supabase.calls.length, 1);
});

test('fails closed when DB readback or lock owner proof is absent', async () => {
  await assert.rejects(createProjectAtomically({ supabase: client({ reportError: { message: 'not found' } }), project, sessionToken: token, device: 'Desktop', clientId: 'client-1' }), /Readback/);
  await assert.rejects(createProjectAtomically({ supabase: client({ owner: false }), project, sessionToken: token, device: 'Desktop', clientId: 'client-1' }), /Sperrbesitz/);
});

test('local draft store requires strict transaction completion and checksum readback', () => {
  const source = fs.readFileSync(new URL('../src/lib/safeProjectCreation.js', import.meta.url), 'utf8');
  assert.match(source, /transaction\(STORE_NAME, 'readwrite', \{ durability: 'strict' \}\)/);
  assert.match(source, /await tx\.done/);
  assert.match(source, /await db\.get\(STORE_NAME, project\.id\)/);
  assert.match(source, /await sha256\(readback\.project\) !== checksum/);
  assert.match(source, /state: 'cloud_confirmed'/);
  assert.match(source, /readback\.state !== 'cloud_confirmed'/);
});

test('App keeps failed cloud creation outside project admission', () => {
  const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const creation = source.slice(source.indexOf('if (isNewProject) {'), source.indexOf('setReports(currentReports =>'));
  const failure = creation.slice(creation.lastIndexOf('} catch (error) {'));
  assert.doesNotMatch(failure, /setView\('details'\)/);
  assert.doesNotMatch(failure, /setSelectedReport\(/);
  assert.match(creation, /await confirmProjectDraftWithReadback\(finalReport\.id\)/);
});

test('a cloud-pending new project reuses its UUID on every retry', () => {
  const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /const pendingNewProjectIdRef = useRef\(null\)/);
  assert.match(source, /if \(!finalReport\.id && isNewProject\) \{\s*finalReport\.id = pendingNewProjectIdRef\.current;/);
  assert.match(source, /if \(isNewProject\) pendingNewProjectIdRef\.current = finalReport\.id;/);
  assert.match(source, /setView\('details'\);\s*pendingNewProjectIdRef\.current = null;/);
});

test('new DamageForm entries are eligible for the first autosave', () => {
  const source = fs.readFileSync(new URL('../src/components/DamageForm.jsx', import.meta.url), 'utf8');
  const editTracking = source.slice(
    source.indexOf('// Track user edit status:'),
    source.indexOf('// Condition checks for starting the autosave timer:')
  );
  const autosave = source.slice(
    source.indexOf('// Condition checks for starting the autosave timer:'),
    source.indexOf('// Save on Unmount')
  );
  assert.doesNotMatch(editTracking, /if \(!initialData\s*\|\|/);
  assert.match(editTracking, /if \(initialData\?\.isLightweight === true\)/);
  assert.doesNotMatch(autosave, /if \(!initialData\s*\|\|/);
  assert.match(autosave, /if \(initialData\?\.isLightweight === true\) return;/);
  assert.match(autosave, /await onSave\(reportData, true, 'user-edit'\)/);
  assert.match(autosave, /if \(savedReport\?\.success === true\)[\s\S]*setLastSaved\(new Date\(\)\)/);
  assert.doesNotMatch(autosave, /finally \{[\s\S]*setLastSaved\(new Date\(\)\)/);
  assert.match(source, /Speicherung ausstehend/);
});
