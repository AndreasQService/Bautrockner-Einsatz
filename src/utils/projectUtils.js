/**
 * Builds a display name from address fields.
 * @param {ProjectRecord} project
 * @returns {string}
 */
export const buildDisplayName = (project) => {
  if (project.street) {
    const locationParts = [project.zip, project.city].filter(Boolean).join(' ').trim();
    return locationParts ? `${project.street}, ${locationParts}` : project.street;
  }
  if (project.address) {
    // If address already contains comma-separated parts, use as-is
    return project.address;
  }
  return project.projectTitle || project.id || '—';
};

export const formatNextAction = (nextAction) => (nextAction || '').length > 48
  ? nextAction.slice(0, 46) + '…'
  : (nextAction || '');

export const formatStatusDuration = (d) => d == null ? '' : d === 0 ? 'Heute' : d === 1 ? '1T' : `${d}T`;
