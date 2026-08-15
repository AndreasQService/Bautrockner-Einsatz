import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/ProjectSessionSyncPanel.jsx', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('runtime panel exposes the required truthful session messages and single explicit exit action', () => {
  assert.match(source, /Projekt offline verfügbar/);
  assert.match(source, /Synchronisieren und Projekt verlassen/);
  assert.match(source, /Supabase OK/);
  assert.match(source, /OneDrive OK/);
  assert.match(source, /Projekt kann noch nicht verlassen werden/);
  assert.match(source, /disabled=\{!model\.canStartSync && !model\.canExit\}/);
});

test('runtime panel delegates every status decision to the fail-closed model', () => {
  assert.match(source, /buildProjectSessionStatusModel/);
  assert.doesNotMatch(source, /readiness\?\.verified\s*\?/);
  assert.doesNotMatch(source, /status\s*===\s*['"]success['"]/);
});

test('project provider confirmations remain visible in the top navigation', () => {
  assert.match(appSource, /id="project-supabase-sync-badge"/);
  assert.match(appSource, /id="project-onedrive-sync-badge"/);
  assert.match(appSource, /headerSyncModel\.supabaseOk \? 'Supabase OK' : 'Supabase ausstehend'/);
  assert.match(appSource, /headerSyncModel\.oneDriveOk \? 'OneDrive OK' : 'OneDrive ausstehend'/);
  assert.match(appSource, /providerBadgeStyle\(headerSyncModel\.supabaseOk\)/);
  assert.match(appSource, /providerBadgeStyle\(headerSyncModel\.oneDriveOk\)/);
});
