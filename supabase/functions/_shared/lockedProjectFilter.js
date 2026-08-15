export function excludeLockedProjectItems(items, activeLocks) {
  const locked = new Set((activeLocks || []).map(row => String(row.open_project_id || '')).filter(Boolean));
  return (items || []).filter(item => !locked.has(String(item.project_id || '')));
}
