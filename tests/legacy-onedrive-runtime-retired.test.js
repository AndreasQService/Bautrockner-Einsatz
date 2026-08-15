import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

test('active project JSON backup no longer calls personal OneDrive', () => {
  const app = read('src/App.jsx');
  assert.doesNotMatch(app, /uploadProjectJson/);
  assert.match(app, /deferredToCentralWorker/);
  assert.match(app, /oneDriveConfirmed: false/);
});

test('legacy JSON and PDF exports fail closed instead of writing through me drive', () => {
  const service = read('src/services/OneDriveService.js');
  const report = service.match(/export async function uploadReport[\s\S]*?\n}/)?.[0] || '';
  const json = service.match(/export async function uploadProjectJson[\s\S]*?\n}/)?.[0] || '';
  assert.match(report, /Direkter PDF-Upload zu OneDrive ist deaktiviert/);
  assert.match(json, /Direktes Projektdaten-JSON zu OneDrive ist deaktiviert/);
  assert.doesNotMatch(report, /uploadFile|graphFetch|\/me\/drive/);
  assert.doesNotMatch(json, /uploadFile|graphFetch|\/me\/drive/);
});

test('central media proof is worker journal evidence without personal drive calls', () => {
  const handler = read('src/lib/offline/supabaseMediaHandlers.js');
  assert.match(handler, /project_image_uploads/);
  assert.match(handler, /storage_status !== 'remote_verified'/);
  assert.match(handler, /remote_drive_id/);
  assert.match(handler, /remote_item_id/);
  assert.match(handler, /remote_etag/);
  assert.match(handler, /remote_sha256/);
  assert.doesNotMatch(handler, /\/me\/drive/);
});

test('DamageForm has no active personal-drive upload/backfill path', () => {
  const form = read('src/components/DamageForm.jsx');
  assert.doesNotMatch(form, /uploadPhotoAndGetUrl|OneDrive-Backfill/);
  assert.doesNotMatch(form, /uploadToOneDrive:\s*true/);
  assert.match(form, /uploadToOneDrive:\s*false/);
  assert.match(form, /kein Legacy-Cloudwrite ausgeführt/);
});

test('all legacy OneDrive mutation exports fail closed while read APIs remain', () => {
  const service = read('src/services/OneDriveService.js');
  for (const name of [
    'ensureProjectFolders', 'uploadPhoto', 'uploadPhotoFile', 'uploadPhotoAndGetUrl',
    'uploadExcel', 'uploadMailText', 'uploadDocument',
  ]) {
    const body = service.match(new RegExp(`export async function ${name}\\b[\\s\\S]*?\\n}`))?.[0] || '';
    assert.match(body, /rejectDirectMutation/);
    assert.doesNotMatch(body, /fetch\(|\/me\/drive|uploadFile|graphFetch/);
  }
  assert.match(service, /export async function getPhotoDownloadUrl/);
});
