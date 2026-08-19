import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isTodoAssignedToOffice, isTodoAssignedToUser, matchesTodoAssigneeFilter } from '../src/lib/todoAssignee.js';

const monitor = readFileSync(new URL('../src/components/TodoMonitor.jsx', import.meta.url), 'utf8');

test('open, history and counters use one canonical assignee identity resolver', () => {
  assert.match(monitor, /from ['"]\.\.\/lib\/todoAssignee\.js['"]/);
  assert.match(monitor, /isTodoAssignedToUser\(t, currentUser/);
  assert.match(monitor, /matchesTodoAssigneeFilter\(t, assigneeFilter, users/);
  assert.doesNotMatch(monitor, /assigned_user_name\.toLowerCase\(\)\.includes\(myName\)/);
});

test('specific user selection is not reduced to a local numeric ID comparison', () => {
  const idOnlyComparisons = monitor.match(/String\(t\.assigned_user_id\)\s*===\s*String\(assigneeFilter\)/g) || [];
  assert.equal(idOnlyComparisons.length, 0);
  assert.match(monitor, /matchesTodoAssigneeFilter/);
});

test('mine counter and rendered mine list share the exact same predicate', () => {
  assert.match(monitor, /mine:\s*currentUser\s*\?\s*activeOpenTodos\.filter\(t\s*=>\s*isTodoAssignedToUser\(t, currentUser/);
  assert.doesNotMatch(monitor, /mine:[^\n]*assigned_user_id/);
});

test('office matching is canonical rather than duplicated in open and history branches', () => {
  assert.match(readFileSync(new URL('../src/lib/todoAssignee.js', import.meta.url), 'utf8'), /isTodoAssignedToOffice/);
  const inlineOfficeBranches = monitor.match(/assigneeFilter\s*===\s*['"]office['"]/g) || [];
  assert.equal(inlineOfficeBranches.length, 0);
});

test('runtime resolver matches exact IDs, email or full name without prefix collisions', () => {
  const adi = { id: '2', supabaseUserId: 'auth-adi', name: 'Adi Shala', email: 'adi@example.ch' };
  assert.equal(isTodoAssignedToUser({ assigned_user_id: '2', assigned_user_name: 'Wrong Name' }, adi), true);
  assert.equal(isTodoAssignedToUser({ assigned_user_name: 'adi@example.ch' }, adi), true);
  assert.equal(isTodoAssignedToUser({ assigned_user_name: 'Adi Shala' }, adi), true);
  assert.equal(isTodoAssignedToUser({ assigned_user_name: 'Adina Keller' }, adi), false);
  assert.equal(isTodoAssignedToUser({ assigned_user_id: '3', assigned_user_name: 'Adi Shala' }, adi), false);
});

test('dropdown and office resolution use the same canonical identities', () => {
  const users = [{ id: '2', name: 'Adi Shala', email: 'adi@example.ch' }];
  assert.equal(matchesTodoAssigneeFilter({ assigned_user_name: 'adi@example.ch' }, '2', users), true);
  assert.equal(matchesTodoAssigneeFilter({ assigned_user_name: 'Adina Keller' }, '2', users), false);
  assert.equal(isTodoAssignedToOffice({ assigned_user_id: 'office', assigned_user_name: 'Inbox' }), true);
  assert.equal(isTodoAssignedToOffice({}), true);
  assert.equal(isTodoAssignedToOffice({ assigned_user_id: '2' }), false);
});
