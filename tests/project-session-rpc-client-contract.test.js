import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const hook = fs.readFileSync(new URL('../src/hooks/useSessionLock.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/supabaseClient.js', import.meta.url), 'utf8');

test('client sends the stable qtool token on normal Supabase requests', () => {
  assert.match(client, /headers\.set\('x-qtool-session-token', qtoolSessionToken\)/);
  assert.equal((client.match(/global: \{ fetch: qtoolAuthenticatedFetch \}/g) || []).length, 2);
  assert.match(app, /setQToolSessionToken\(t\);[\s\S]*?sessionTokenRef\.current = t/);
});

test('runtime has zero direct project_sessions table access', () => {
  for (const source of [hook, app]) {
    assert.doesNotMatch(source, /from\(['"]project_sessions['"]\)/);
  }
  assert.match(hook, /rpc\('acquire_project_lock'/);
  assert.match(hook, /rpc\('get_project_lock_status'/);
  assert.match(hook, /rpc\('release_project_lock'/);
});

test('lock errors and denials remain fail closed without iPad takeover', () => {
  const acquire = hook.slice(hook.indexOf('const upsertSession'), hook.indexOf('const registerProjectActivity'));
  assert.match(acquire, /if \(error\)[\s\S]*?setIsSessionActive\(false\)/);
  assert.match(acquire, /result && result\.acquired[\s\S]*?setIsSessionActive\(true\)/);
  assert.doesNotMatch(acquire, /iPad priority override|\.delete\(\)/);
  assert.match(acquire, /p_user_id:\s+String\(authenticatedUserId\)/);
  assert.doesNotMatch(acquire, /p_user_id:\s+String\(userId\)/);
  assert.match(acquire, /AUTH_UUID\.test\(String\(authenticatedUserId \|\| ''\)\)/);
  assert.match(app, /supabaseSession\?\.user\?\.id \?\? null/);
  const poll = hook.slice(hook.indexOf('const pollSessions'), hook.indexOf('// Main lifecycle'));
  assert.match(poll, /if \(error\)[\s\S]*?setIsSessionActive\(false\)/);
  assert.match(poll, /status\?\.is_owner === true/);
});

test('cleanup never releases and explicit release requires RPC true', () => {
  const lifecycle = hook.slice(hook.indexOf('export function startSessionLockLifecycle'), hook.indexOf('export function useSessionLock'));
  assert.doesNotMatch(lifecycle, /release_project_lock|deleteSession\(/);
  const release = hook.slice(hook.indexOf('const deleteSession'), hook.indexOf('const pollSessions'));
  assert.match(release, /rpc\('release_project_lock'/);
  assert.match(release, /if \(error \|\| data !== true\)/);
  assert.match(app, /registerProjectActivity,\s*releaseProjectLock/);
  const exit = app.slice(app.indexOf('const handleCancelEntry'), app.indexOf('const handleSaveReport'));
  const readback = exit.indexOf("from('damage_reports').select('id, updated_at, report_data')");
  const status = exit.indexOf("rpc('get_project_lock_status'");
  const releaseCall = exit.indexOf('await releaseProjectLock()');
  const navigate = exit.indexOf("setView('dashboard')");
  assert.ok(status >= 0 && readback > status && releaseCall > readback && navigate > releaseCall);
  assert.doesNotMatch(exit, /reportId && isSessionActiveRef\.current/);
  assert.match(exit, /if \(lockStatusError\)[\s\S]*?return;/);
  assert.match(exit, /if \(ownsDatabaseLock\) \{/);
  assert.match(exit, /if \(await releaseProjectLock\(\) !== true\)[\s\S]*?return;/);
  assert.match(exit, /silentSaveDebounceTimers\.current\[reportId\]/);
  assert.match(exit, /await pendingWrite/);
  assert.match(exit, /unsavedReportsRef\.current = JSON\.parse/);
  assert.match(exit, /if \(!exactPayloadMatch && !sameConfirmedClient\)/);
});

test('opening an existing project stays inactive until RPC ownership proof', () => {
  const open = app.slice(app.indexOf('openedReportBackupRef.current[activeReport.id]'), app.indexOf('loadFullReport();', app.indexOf('openedReportBackupRef.current[activeReport.id]')));
  assert.match(open, /setIsSessionActive\(false\)/);
  assert.doesNotMatch(open, /setIsSessionActive\(true\)/);
});

test('invalid persisted tokens are regenerated and takeover UI is absent', () => {
  assert.match(app, /if \(!t \|\| t\.length < 20\)/);
  assert.doesNotMatch(app, /Hier weiterarbeiten|takeOverLock/);
  assert.doesNotMatch(hook, /20 \* 60 \* 1000|iPad priority override/);
});

test('inactivity keeps the selected project visible and cloud failures reject evidence', () => {
  const inactivity = app.slice(app.indexOf('const handleInactivityTimeout'), app.indexOf('// Projektspezifischer Modus'));
  assert.match(inactivity, /setIsSessionActive\(false\)/);
  assert.match(inactivity, /setShowInactivityAlert\(true\)/);
  assert.doesNotMatch(inactivity, /setView\(|setSelectedReport\(/);
  const save = app.slice(app.indexOf('const performCloudSave'), app.indexOf('const hasImageChanges'));
  assert.match(save, /catch \(err\) \{\s*handleSaveError\(err\);\s*throw err;/);
  assert.match(save, /confirmedProjectPayloadRef\.current\.set/);
  assert.match(save, /return \{ success: true/);
});

test('successful atomic creation seeds exact canonical exit evidence', () => {
  const creation = app.slice(app.indexOf('if (isNewProject) {'), app.indexOf('setReports(currentReports =>'));
  assert.match(creation, /const creationPayload = JSON\.parse\(JSON\.stringify\(finalReport\)\)/);
  assert.match(creation, /project: creationPayload/);
  assert.match(creation, /await confirmProjectDraftWithReadback\(finalReport\.id\)[\s\S]*?confirmedProjectPayloadRef\.current\.set\(finalReport\.id, creationPayload\)/);
});
