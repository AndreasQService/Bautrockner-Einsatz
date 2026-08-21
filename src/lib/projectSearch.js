const SEARCH_FIELDS = [
  'projectNumber',
  'projectTitle',
  'client',
  'address',
  'street',
  'zip',
  'city',
  'locationDetails',
  'damageLocation',
];

export function normalizeProjectSearchValue(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLocaleLowerCase('de-CH')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getProjectSearchText(report) {
  const nested = report?.report_data && typeof report.report_data === 'object'
    ? report.report_data
    : {};

  return normalizeProjectSearchValue(
    SEARCH_FIELDS.flatMap(field => [report?.[field], nested[field]]).join(' '),
  );
}

export function projectMatchesSearch(report, searchTerm) {
  const query = normalizeProjectSearchValue(searchTerm);
  return !query || getProjectSearchText(report).includes(query);
}
