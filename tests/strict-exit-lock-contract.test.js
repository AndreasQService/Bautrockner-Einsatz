import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const lock = readFileSync(new URL('../src/hooks/useSessionLock.js', import.meta.url), 'utf8');
const oneDrive = readFileSync(new URL('../src/services/OneDriveService.js', import.meta.url), 'utf8');
const mediaHandler = readFileSync(new URL('../src/lib/offline/supabaseMediaHandlers.js', import.meta.url), 'utf8');

test('strict exit requires project outbox, Supabase and OneDrive verification', () => {
  assert.match(app, /getPendingSummary\(projectId\)/);
  assert.match(app, /latest\.dbConfirmed/);
  assert.match(app, /oneDriveEvidence: latest\.oneDriveEvidence/);
  assert.match(app, /buildStrictExitReadiness/);
  assert.match(app, /findUnverifiedOneDriveMedia\(verifiedProjectRow\.report_data\)/);
  assert.match(app, /oneDriveSha256/);
  assert.match(app, /compareProjectReportData/);
  assert.match(app, /collectStrictExitCloudEvidence/);
  assert.match(app, /Supabase: OK · OneDrive: OK/);
  assert.match(app, /await confirmProjectSession\(projectId, readiness\.evidence\)/);
  assert.match(app, /Offline: Supabase und OneDrive können nicht bestätigt werden/);
});

test('release happens only after the actual guarded action', () => {
  const actionPosition = app.indexOf('const actionResult = await action()');
  const stagedEvidencePosition = app.indexOf('await stageProjectSessionConfirmation(projectId, readiness.evidence)');
  const evidencePosition = app.indexOf('await confirmProjectSession(projectId, readiness.evidence)');
  const releasePosition = app.indexOf('await releaseProjectLock(projectId)', actionPosition);
  assert.ok(stagedEvidencePosition > 0 && stagedEvidencePosition < actionPosition, 'full evidence must be durable before navigation');
  assert.ok(actionPosition > 0, 'guarded action missing');
  assert.ok(releasePosition > actionPosition, 'release must follow actual navigation');
  assert.ok(evidencePosition > releasePosition, 'session must remain recoverable until lock release succeeds');
  assert.doesNotMatch(lock, /effect cleanup[\s\S]{0,500}deleteSession\(\)/);
  assert.match(lock, /p_session_token: tokenRef\.current/);
  assert.match(lock, /data !== true/);
});

test('inactivity and browser unload cannot release an unconfirmed project', () => {
  const inactivity = lock.slice(lock.indexOf('INACTIVITY_TIMEOUT'), lock.indexOf('// 2. Query other active sessions'));
  assert.doesNotMatch(inactivity, /deleteSession\(/);
  assert.match(app, /Browser unload cannot finish DB\/Storage\/OneDrive readbacks/);
  assert.match(app, /event\.returnValue = ''/);
});

test('personal-drive project backup is retired and exact worker evidence is mandatory', () => {
  const projectJson = oneDrive.match(/export async function uploadProjectJson[\s\S]*?\n}/)?.[0] || '';
  assert.match(projectJson, /Direktes Projektdaten-JSON zu OneDrive ist deaktiviert/);
  assert.doesNotMatch(projectJson, /\/me\/drive|uploadFile|verified:\s*true/);
  assert.match(mediaHandler, /storage_status !== 'remote_verified'/);
  assert.match(mediaHandler, /remote_drive_id/);
  assert.match(mediaHandler, /remote_item_id/);
  assert.match(mediaHandler, /remote_etag/);
  assert.match(mediaHandler, /remote_sha256/);
  assert.doesNotMatch(mediaHandler, /\/me\/drive/);
});
