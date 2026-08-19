import test from 'node:test';
import assert from 'node:assert/strict';
import { compareTodosByDueDateAndProject, isTodoAssignedToOffice, isTodoAssignedToUser, matchesTodoAssigneeFilter } from '../src/lib/todoAssignee.js';

const andreas = { id: 4, supabaseUserId: 'auth-andreas', name: 'Andreas Strehler', email: 'andreas@example.ch' };
const adi = { id: 7, name: 'Adi' };
const adina = { id: 8, name: 'Adina' };

test('matches exact auth/local IDs and exact normalized legacy names', () => {
  assert.equal(isTodoAssignedToUser({ assigned_user_id: 'auth-andreas', assigned_user_name: 'irrelevant' }, andreas), true);
  assert.equal(isTodoAssignedToUser({ assigned_user_id: '4' }, andreas), true);
  assert.equal(isTodoAssignedToUser({ assigned_user_name: ' ANDREAS STREHLER ' }, andreas), true);
  assert.equal(isTodoAssignedToUser({ assigned_user_name: 'andreas@example.ch' }, andreas), true);
});

test('explicit mismatched ID cannot cross-match by name and names are never fuzzy', () => {
  assert.equal(isTodoAssignedToUser({ assigned_user_id: '999', assigned_user_name: 'Andreas Strehler' }, andreas), false);
  assert.equal(isTodoAssignedToUser({ assigned_user_name: 'Adina' }, adi), false);
  assert.equal(isTodoAssignedToUser({ assigned_user_name: 'Adi' }, adina), false);
});

test('office requires explicit office identity or both identity fields empty', () => {
  assert.equal(isTodoAssignedToOffice({ assigned_user_id: 'office' }), true);
  assert.equal(isTodoAssignedToOffice({ assigned_user_name: 'Innendienst' }), true);
  assert.equal(isTodoAssignedToOffice({}), true);
  assert.equal(isTodoAssignedToOffice({ assigned_user_id: '4' }), false);
});

test('dropdown resolution uses the same canonical resolver', () => {
  assert.equal(matchesTodoAssigneeFilter({ assigned_user_id: 'auth-andreas' }, '4', [andreas]), true);
  assert.equal(matchesTodoAssigneeFilter({ assigned_user_name: 'Adi' }, '7', [adi, adina]), true);
  assert.equal(matchesTodoAssigneeFilter({ assigned_user_name: 'Adina' }, '7', [adi, adina]), false);
});

test('secondary sort resolves each todo against its own project', () => {
  const reports = [
    { id: 'p-a', projectTitle: 'Alpha' },
    { id: 'p-z', projectTitle: 'Zulu' },
  ];
  const todos = [
    { id: 'z', project_id: 'p-z', due_date: '2026-08-20' },
    { id: 'a', project_id: 'p-a', due_date: '2026-08-20' },
  ];
  assert.deepEqual(todos.sort((a, b) => compareTodosByDueDateAndProject(a, b, reports)).map(todo => todo.id), ['a', 'z']);
});
