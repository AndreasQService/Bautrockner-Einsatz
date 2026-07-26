/**
 * Builds a display name from address fields.
 * @param {ProjectRecord} project
 * @returns {string}
 */
export const buildDisplayName = (project) => {
  if (project.street) return `${project.street}${project.city ? ', ' + project.city : ''}`;
  if (project.address) return project.address.split(',')[0];
  return project.projectTitle || project.id || '—';
};

export const formatNextAction = (nextAction) => (nextAction || '').length > 48
  ? nextAction.slice(0, 46) + '…'
  : (nextAction || '');

export const formatStatusDuration = (d) => d == null ? '' : d === 0 ? 'Heute' : d === 1 ? '1T' : `${d}T`;
