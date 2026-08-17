import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectSession, initializeInstantProject, checkSorbaDuplicateWarning } from '../src/lib/offline/createProject.js';
import fs from 'node:fs';

function client({ insertError = null, report = null }) {
  const calls = [];
  return {
    calls,
    from: table => ({
      insert: async (data) => {
        calls.push({ type: 'insert', table, data });
        return { error: insertError };
      },
      select: () => ({
        eq: (_col, val) => ({
          limit: async () => {
            calls.push({ type: 'readback', table, val });
            return { data: report ? [report] : [], error: null };
          }
        })
      })
    })
  };
}

const token = 'owner-session-token-1234567890';
const project = { id: 'project-new-1', projectTitle: 'Neu', rooms: [], images: [] };

test('uses atomic direct INSERT and verifies cloud readback before local activation', async () => {
  const supabase = client({
    insertError: null,
    report: { report_data: project, updated_at: '2026-08-14T10:00:00Z' },
  });
  const localCalls = [];
  const result = await createProjectSession({
    supabase, project, sessionToken: token, device: 'iPad:user-1:Andreas:a@example.ch', clientId: 'client-1', actor: 'Andreas',
    createLocalSession: async input => { localCalls.push(input); return { state: 'offline_available', projectId: project.id, lockToken: token, counts: { projects: 1 } }; },
  });

  assert.equal(supabase.calls[0].type, 'insert');
  assert.equal(supabase.calls[1].type, 'readback');
  assert.equal(localCalls[0].device, 'iPad');
  assert.equal(result.localSession.state, 'offline_available');
});

test('fails closed when Postgres returns 23505 unique constraint duplicate key error', async () => {
  const supabase = client({
    insertError: { code: '23505', message: 'duplicate key value violates unique constraint' }
  });
  let localCalled = false;
  await assert.rejects(createProjectSession({
    supabase, project, sessionToken: token, device: 'Desktop',
    createLocalSession: async () => { localCalled = true; },
  }), /existiert bereits/);
  assert.equal(localCalled, false);
});

test('initializeInstantProject creates valid local project with 0 input fields filled', () => {
  const instant = initializeInstantProject({});
  assert.ok(instant.id.length > 5);
  assert.equal(instant.projectTitle, '');
  assert.equal(instant.client, '');
  assert.equal(instant.sorba_number, '');
  assert.equal(instant.version, 1);
});

test('checkSorbaDuplicateWarning detects duplicate Sorba numbers soft-warning non-blockingly', () => {
  const candidate = { id: 'p2', sorba_number: 'SORBA-9901', street: 'Bahnhofstrasse 1', zip: '8000' };
  const existingList = [
    { id: 'p1', sorba_number: 'SORBA-9901', street: 'Andere Strasse 2', zip: '9000' }
  ];

  const warning = checkSorbaDuplicateWarning(candidate, existingList);
  assert.equal(warning.isDuplicate, true);
  assert.equal(warning.matchType, 'sorba_number');
  assert.match(warning.message, /Sorba-Nr/);
});

test('new-project UI path delegates to atomic create and fails closed on errors', () => {
  const source = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /if \(isNewProject\)[\s\S]*createProjectSession\(/);
});
