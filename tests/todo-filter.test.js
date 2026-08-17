import test from 'node:test';
import assert from 'node:assert/strict';

// Helper functions under test
function getTodoAssigneeName(t) {
  if (!t) return '';
  return String(
    t.assignedTo ||
    t.assigned_user_name ||
    t.assignee ||
    t.technician ||
    t.assignedUserName ||
    ''
  ).toLowerCase().trim();
}

function getTodoAssigneeId(t) {
  if (!t) return '';
  const val = String(t.assigned_user_id || t.assignedUserId || t.userId || t.user_id || '').trim();
  if (!val || val === 'null' || val === 'undefined') return '';
  return val;
}

function isTodoAssignedToUser(t, user) {
  if (!t || !user) return false;

  const targetUserId = String(user.id || '').trim();
  const targetUserEmail = String(user.email || '').trim().toLowerCase();
  const targetUserName = String(user.name || '').trim().toLowerCase();
  const targetFirstName = targetUserName.split(' ')[0];

  const todoUserId = getTodoAssigneeId(t);
  const todoUserName = getTodoAssigneeName(t);

  if (targetUserId && todoUserId && (todoUserId === targetUserId || String(todoUserId) === targetUserId)) {
    return true;
  }
  if (targetUserEmail && todoUserName === targetUserEmail) {
    return true;
  }
  if (targetUserName && todoUserName) {
    if (todoUserName === targetUserName) return true;
    if (todoUserName.includes(targetUserName) || targetUserName.includes(todoUserName)) return true;
    if (targetFirstName && todoUserName.includes(targetFirstName)) return true;
  }
  return false;
}

function matchesAssigneeFilter(t, filterVal, currentUser = null, users = []) {
  if (!filterVal || filterVal === 'all' || filterVal === 'Alle') return true;

  if (filterVal === 'mine' || filterVal === 'Meine') {
    if (!currentUser) return false;
    return isTodoAssignedToUser(t, currentUser);
  }

  if (filterVal === 'office' || filterVal === 'unassigned' || filterVal === 'Unzugewiesen') {
    const todoUserId = getTodoAssigneeId(t);
    const todoUserName = getTodoAssigneeName(t);
    if (todoUserId === 'office' || todoUserName === 'innendienst' || todoUserName === 'unzugewiesen') return true;
    if (!todoUserId && !todoUserName) return true;
    return false;
  }

  const target = String(filterVal).toLowerCase().trim();
  const todoUserId = getTodoAssigneeId(t);
  const todoUserName = getTodoAssigneeName(t);

  if (todoUserId && (todoUserId === target || String(todoUserId) === target)) return true;

  const targetUser = Array.isArray(users) ? users.find(u =>
    String(u.id) === target ||
    String(u.name).toLowerCase().trim() === target ||
    String(u.name).toLowerCase().trim().startsWith(target)
  ) : null;

  if (targetUser && isTodoAssignedToUser(t, targetUser)) {
    return true;
  }

  if (todoUserName) {
    if (todoUserName.includes(target)) return true;
    if (target.includes(todoUserName) && todoUserName.length > 0) return true;
    const todoFirstName = todoUserName.split(' ')[0];
    if (todoFirstName && (todoFirstName === target || target.includes(todoFirstName))) return true;
  }

  return false;
}

test('Todo Assignee Resolution: extracts name and ID across all legacy field aliases', () => {
  assert.equal(getTodoAssigneeName({ assignedTo: 'Adi Shala' }), 'adi shala');
  assert.equal(getTodoAssigneeName({ assigned_user_name: 'Mensur Sherifi' }), 'mensur sherifi');
  assert.equal(getTodoAssigneeName({ technician: 'Adi' }), 'adi');
  assert.equal(getTodoAssigneeName({ assignee: 'mensur@qservice.ch' }), 'mensur@qservice.ch');
  assert.equal(getTodoAssigneeName({ assignedUserName: 'Techniker 1' }), 'techniker 1');
  assert.equal(getTodoAssigneeName({}), '');

  assert.equal(getTodoAssigneeId({ assigned_user_id: '2' }), '2');
  assert.equal(getTodoAssigneeId({ assignedUserId: 3 }), '3');
  assert.equal(getTodoAssigneeId({ userId: 'usr-100' }), 'usr-100');
  assert.equal(getTodoAssigneeId({}), '');
});

test('Todo Assignee Filtering: "Alle" returns true for all tasks', () => {
  const t1 = { task: 'Task 1', assignedTo: 'Adi Shala' };
  const t2 = { task: 'Task 2', assigned_user_name: 'Mensur Sherifi' };
  const t3 = { task: 'Task 3' };

  assert.equal(matchesAssigneeFilter(t1, 'all'), true);
  assert.equal(matchesAssigneeFilter(t2, 'Alle'), true);
  assert.equal(matchesAssigneeFilter(t3, 'all'), true);
});

test('Todo Assignee Filtering: "Meine" matches current user by id, email, or name', () => {
  const currentUser = { id: '2', name: 'Adi Shala', email: 'adi@qservice.ch' };
  const tAdiId = { task: 'Task 1', assigned_user_id: '2' };
  const tAdiName = { task: 'Task 2', assignedTo: 'Adi Shala' };
  const tAdiNick = { task: 'Task 3', technician: 'Adi' };
  const tMensur = { task: 'Task 4', assigned_user_name: 'Mensur Sherifi', assigned_user_id: '3' };

  assert.equal(matchesAssigneeFilter(tAdiId, 'Meine', currentUser), true);
  assert.equal(matchesAssigneeFilter(tAdiName, 'Meine', currentUser), true);
  assert.equal(matchesAssigneeFilter(tAdiNick, 'Meine', currentUser), true);
  assert.equal(matchesAssigneeFilter(tMensur, 'Meine', currentUser), false);
});

test('Todo Assignee Filtering: Specific Technician ("Adi", "Mensur") matches partial/full names case-insensitively', () => {
  const users = [
    { id: '2', name: 'Adi Shala' },
    { id: '3', name: 'Mensur Sherifi' }
  ];

  const tAdiFull = { task: 'Report Adi', assignedTo: 'Adi Shala' };
  const tAdiPartial = { task: 'Fix moisture', technician: 'Adi' };
  const tMensurFull = { task: 'Apparatus Check', assigned_user_name: 'Mensur Sherifi' };
  const tMensurPartial = { task: 'Setup drying', assignee: 'Mensur' };
  const tUnassigned = { task: 'General task' };

  // Filter "Adi"
  assert.equal(matchesAssigneeFilter(tAdiFull, 'Adi', null, users), true);
  assert.equal(matchesAssigneeFilter(tAdiPartial, 'adi', null, users), true);
  assert.equal(matchesAssigneeFilter(tMensurFull, 'Adi', null, users), false);
  assert.equal(matchesAssigneeFilter(tUnassigned, 'Adi', null, users), false);

  // Filter "Mensur"
  assert.equal(matchesAssigneeFilter(tMensurFull, 'Mensur', null, users), true);
  assert.equal(matchesAssigneeFilter(tMensurPartial, 'mensur', null, users), true);
  assert.equal(matchesAssigneeFilter(tAdiFull, 'Mensur', null, users), false);
  assert.equal(matchesAssigneeFilter(tUnassigned, 'Mensur', null, users), false);
});

test('Todo Assignee Filtering: Unassigned / Innendienst fallback', () => {
  const tUnassigned = { task: 'No person' };
  const tOffice = { task: 'Office task', assigned_user_id: 'office', assigned_user_name: 'Innendienst' };
  const tAdi = { task: 'Field work', assignedTo: 'Adi Shala' };

  assert.equal(matchesAssigneeFilter(tUnassigned, 'office'), true);
  assert.equal(matchesAssigneeFilter(tOffice, 'Unzugewiesen'), true);
  assert.equal(matchesAssigneeFilter(tAdi, 'office'), false);
});
