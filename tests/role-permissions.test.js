import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { canDeleteData, canUnregisterDevice } from '../src/lib/permissions.js';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const devices = fs.readFileSync(new URL('../src/components/DeviceManager.jsx', import.meta.url), 'utf8');
const monitor = fs.readFileSync(new URL('../src/components/TodoMonitor.jsx', import.meta.url), 'utf8');
const projectTodos = fs.readFileSync(new URL('../src/components/TodoProjectSection.jsx', import.meta.url), 'utf8');

test('only administrators may delete data', () => {
  assert.equal(canDeleteData({ role: 'admin' }), true);
  for (const role of ['technician', 'handwerker', 'user', '', null]) {
    assert.equal(canDeleteData({ role }), false, `${role} must not delete`);
  }
});

test('all four application roles may unregister a device', () => {
  for (const role of ['admin', 'technician', 'handwerker', 'user']) {
    assert.equal(canUnregisterDevice({ role }), true, `${role} should unregister devices`);
  }
  assert.equal(canUnregisterDevice({ role: 'unknown' }), false);
});

test('destructive runtime handlers and controls use the central permission boundary', () => {
  assert.match(app, /if \(!canDeleteData\(currentUser\)\)[\s\S]*?Nur Administratoren dürfen Projekte löschen/);
  assert.match(devices, /if \(!canDeleteData\(currentUser\)\)/);
  assert.match(devices, /canUnregisterDevice\(currentUser\)/);
  assert.match(monitor, /canDeleteData\(currentUser\) && <button[\s\S]*?Aufgabe löschen/);
  assert.match(projectTodos, /canDeleteData\(currentUser\) && <button[\s\S]*?To-do löschen/);
});
