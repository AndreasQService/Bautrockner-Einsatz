import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('project reads remain available to local QTool users while unauthenticated writes stay blocked', () => {
  const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const syncSource = fs.readFileSync(new URL('../src/services/ProjectSyncService.js', import.meta.url), 'utf8');
  const fetchStart = appSource.indexOf('const fetchReports = useCallback(');
  const queryStart = appSource.indexOf('let query = supabase', fetchStart);
  const preQueryGuard = appSource.slice(fetchStart, queryStart);

  assert.ok(fetchStart >= 0 && queryStart > fetchStart, 'fetchReports query must remain present');
  assert.doesNotMatch(preQueryGuard, /getSession|Nicht authentifiziert/, 'project reads must not require a Supabase auth session');
  assert.match(syncSource, /Schreiben blockiert: Keine aktive Supabase-Session im Testmodus\./, 'test writes must remain blocked without a Supabase session');
});