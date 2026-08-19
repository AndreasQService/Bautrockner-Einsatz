const normalize = value => String(value ?? '').trim().toLocaleLowerCase('de-CH');
const values = (...items) => new Set(items.map(normalize).filter(Boolean));

export function getUserAssigneeIdentity(user = {}) {
  return {
    ids: values(user.id, user.supabaseUserId, user.supabase_user_id, user.auth_user_id, user.authUserId),
    names: values(user.name, user.full_name, user.fullName, user.email, user.authEmail, user.auth_email),
  };
}

export function isTodoAssignedToUser(todo = {}, user = {}) {
  const identity = getUserAssigneeIdentity(user);
  const todoId = normalize(todo.assigned_user_id ?? todo.assignedUserId);
  const todoName = normalize(todo.assigned_user_name ?? todo.assignedUserName);
  // An explicit ID is authoritative. Never cross-match it through a name.
  if (todoId) return identity.ids.has(todoId);
  if (todoName) return identity.names.has(todoName);
  return false;
}

export function isTodoAssignedToOffice(todo = {}) {
  const todoId = normalize(todo.assigned_user_id ?? todo.assignedUserId);
  const todoName = normalize(todo.assigned_user_name ?? todo.assignedUserName);
  return todoId === 'office' || todoName === 'innendienst' || (!todoId && !todoName);
}

export function matchesTodoAssigneeFilter(todo, filter, users = []) {
  if (filter === 'all') return true;
  if (filter === 'office') return isTodoAssignedToOffice(todo);
  const normalizedFilter = normalize(filter);
  const user = users.find(candidate => getUserAssigneeIdentity(candidate).ids.has(normalizedFilter));
  return user ? isTodoAssignedToUser(todo, user) : false;
}

export function compareTodosByDueDateAndProject(a = {}, b = {}, reports = []) {
  const dueComparison = String(a.due_date || '').localeCompare(String(b.due_date || ''));
  if (dueComparison !== 0) return dueComparison;
  const projectTitle = todo => reports.find(report =>
    String(report.id) === String(todo.project_id)
    || (report.projectNumber && String(report.projectNumber) === String(todo.project_id))
  )?.projectTitle || '';
  return projectTitle(a).localeCompare(projectTitle(b), 'de-CH');
}
