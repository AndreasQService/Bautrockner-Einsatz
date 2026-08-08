const normalizeMarker = (value) => String(value ?? '').trim().toLowerCase();

/**
 * Technical rows share the damage_reports transport with real projects but must
 * never be exposed in a project list.
 */
export const isTechnicalProjectRow = (row) => {
  if (!row || typeof row !== 'object') return true;

  const markers = [
    row.id,
    row.projectTitle,
    row.project_title,
    row.report_data?.id,
    row.report_data?.projectTitle,
    row.report_data?.project_title,
  ].map(normalizeMarker);

  return markers.some(marker =>
    marker === 'system_settings' ||
    marker === '__session__' ||
    marker.startsWith('session_') ||
    marker.startsWith('__session_')
  );
};

export const isVisibleProjectRow = (row) => !isTechnicalProjectRow(row);