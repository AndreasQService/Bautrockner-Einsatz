import test from 'node:test';
import assert from 'node:assert/strict';
import { createLockedProjectSession } from '../src/lib/offline/createLockedProject.js';
import fs from 'node:fs';

function client({ rpcData, rpcError = null, report, locks }) {
  const calls = [];
  return {
    calls,
    rpc: async (name, payload) => {
      calls.push({ type: 'rpc', name, payload });
      return name === 'get_project_lock_status'
        ? { data: locks, error: null }
        : { data: rpcData, error: rpcError };
    },
    from: table => ({ select: () => ({ eq: (_column, value) => {
      calls.push({ type: 'read', table, value });
      return table === 'damage_reports'
        ? { single: async () => ({ data: report, error: null }) }
        : Promise.resolve({ data: locks, error: null });
    } }) }),
  };
}

const token = 'owner-session-token-1234567890';
const project = { id: 'project-new-1', projectTitle: 'Neu', rooms: [], images: [] };

test('uses atomic create/lock RPC and verifies both cloud rows before local activation', async () => {
  const supabase = client({
    rpcData: { created: true, project_id: project.id, offline_prepare_required: true },
    report: { report_data: project, updated_at: '2026-08-14T10:00:00Z' },
    locks: [{ open_project_id: project.id, is_owner: true, device_type: 'iPad' }],
  });
  const localCalls = [];
  const result = await createLockedProjectSession({
    supabase, project, sessionToken: token, device: 'iPad:user-1:Andreas:a@example.ch', clientId: 'client-1', actor: 'Andreas',
    createLocalSession: async input => { localCalls.push(input); return { state: 'offline_available', projectId: project.id, lockToken: token, counts: { projects: 1 } }; },
  });
  assert.equal(supabase.calls[0].name, 'create_project_and_acquire_lock');
  assert.equal(supabase.calls[0].payload.p_session_token, token);
  assert.equal(supabase.calls.some(call => call.name === 'get_project_lock_status'), true);
  assert.equal(supabase.calls.some(call => call.table === 'project_sessions'), false);
  assert.equal(localCalls[0].device, 'iPad');
  assert.equal(result.session.state, 'offline_available');
});

test('fails closed on incomplete RPC confirmation without reads or local activation', async () => {
  const supabase = client({ rpcData: { created: true, project_id: project.id }, report: null, locks: [] });
  let localCalled = false;
  await assert.rejects(createLockedProjectSession({
    supabase, project, sessionToken: token, device: 'Desktop',
    createLocalSession: async () => { localCalled = true; },
  }), /Ungültige Bestätigung/);
  assert.equal(localCalled, false);
  assert.equal(supabase.calls.length, 1);
});

test('fails closed unless exactly one matching owner lock is read back', async () => {
  const supabase = client({
    rpcData: { created: true, project_id: project.id, offline_prepare_required: true },
    report: { report_data: project, updated_at: '2026-08-14T10:00:00Z' },
    locks: [{ open_project_id: project.id, is_owner: false }],
  });
  await assert.rejects(createLockedProjectSession({
    supabase, project, sessionToken: token, device: 'Desktop', createLocalSession: async () => ({}),
  }), /Eigentümersperre/);
});

test('new-project UI path delegates to atomic create and fails closed on errors', () => {
  const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /if \(isNewProject\)[\s\S]*createLockedProjectSession\(/);
  assert.match(source, /catch \(error\) \{[\s\S]*setIsSessionActive\(false\)[\s\S]*phase: 'blocked'/);
  assert.doesNotMatch(source.match(/if \(isNewProject\) \{[\s\S]*?return finalReport;/)?.[0] || '', /\.from\('damage_reports'\)\.(?:insert|upsert)/);
});
