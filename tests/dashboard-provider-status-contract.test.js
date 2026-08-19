import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../src/lib/onedrive/auth.js', import.meta.url), 'utf8');

test('database badge is always present and only green after online Supabase success', () => {
  assert.match(app, /id="supabase-status-badge"/);
  assert.match(app, /isOnline && supabaseStatus\?\.ok === true \? 'Datenbank verbunden' : 'Datenbank ausstehend'/);
  assert.doesNotMatch(app, /syncPending === 0 \? 'Datenbank verbunden'/);
});

test('OneDrive success requires silent token and verified Graph drive id', () => {
  assert.match(app, /const account = await initOneDriveAuth\(\)/);
  assert.match(app, /const token = await getGraphAccessTokenSilent\(\)/);
  assert.match(app, /graph\.microsoft\.com\/v1\.0\/me\/drive\?\$select=id,driveType/);
  assert.match(app, /if \(!response\.ok\)/);
  assert.match(app, /if \(!drive\?\.id\)/);
  assert.match(app, /id="dashboard-onedrive-status-badge"/);
});

test('interactive Microsoft login is restricted to the explicit connect button', () => {
  const health = app.slice(app.indexOf('const verifyOneDriveServiceConnectivity'), app.indexOf('const handleConnectOneDrive'));
  const connect = app.slice(app.indexOf('const handleConnectOneDrive'), app.indexOf('useEffect(() =>', app.indexOf('const handleConnectOneDrive')));
  assert.doesNotMatch(health, /connectOneDrive/);
  assert.match(connect, /await connectOneDrive\(\)/);
  const backgroundToken = auth.slice(auth.indexOf('export async function getGraphAccessToken()'), auth.indexOf('export async function getGraphAccessTokenSilent()'));
  assert.match(backgroundToken, /if \(!account\) return null/);
  assert.doesNotMatch(backgroundToken, /connectOneDrive\(|loginPopup\(/);
  const explicitConnect = auth.slice(auth.indexOf('export async function connectOneDrive()'), auth.indexOf('export async function getGraphAccessToken()'));
  assert.match(explicitConnect, /loginPopup\(loginRequest\)/);
});

test('offline event immediately invalidates OneDrive status', () => {
  assert.match(app, /const onOffline = \(\) => setOneDriveServiceStatus\(\{ ok: false, error: 'Offline'/);
  assert.match(app, /addEventListener\('offline', onOffline\)/);
  assert.match(app, /removeEventListener\('offline', onOffline\)/);
});
