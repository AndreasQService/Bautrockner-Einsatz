const asArray = (value) => Array.isArray(value) ? value : [];

const uniqueBy = (rows, key) => {
  const seen = new Set();
  return rows.filter((row, index) => {
    const value = row?.[key] ?? `${index}:${JSON.stringify(row)}`;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const projectRooms = (project) => uniqueBy([
  ...asArray(project?.rooms),
  ...asArray(project?.measurementRooms),
], 'id');

const collectImages = (value, seenObjects = new Set(), seenImages = new Set()) => {
  if (!value || typeof value !== 'object' || seenObjects.has(value)) return [];
  seenObjects.add(value);
  if (Array.isArray(value)) return value.flatMap((entry) => collectImages(entry, seenObjects, seenImages));
  const url = value.preview || value.url || value.storagePath || value.supabasePath || '';
  const image = Boolean(url && (
    /^data:image\//i.test(url) || /^blob:/i.test(url) ||
    /\.(jpe?g|png|webp|heic)(\?|$)/i.test(url) || value.storagePath || value.supabasePath
  ));
  const rows = [];
  if (image) {
    const key = String(value.id || value.entityId || value.storagePath || value.supabasePath || url);
    if (!seenImages.has(key)) {
      seenImages.add(key);
      rows.push(value);
    }
  }
  return rows.concat(Object.values(value).flatMap((entry) => collectImages(entry, seenObjects, seenImages)));
};

export function countProjectSyncContent(project = {}) {
  const rooms = projectRooms(project);
  const protocols = rooms.filter((room) => {
    const data = room?.measurementData;
    return Boolean(data && (asArray(data.measurements).length || data.protocolUrl || data.canvasImage || asArray(data.galleryPhotos).length));
  });
  const measurementValues = protocols.reduce((total, room) => total + asArray(room.measurementData?.measurements).length, 0);
  const devices = asArray(project.equipment || project.devices);
  const todos = asArray(project.todos || project.projectTodos);
  const pdfs = [
    ...asArray(project.pdfs), ...asArray(project.reports),
  ].filter((entry) => /\.pdf(\?|$)/i.test(entry?.name || entry?.url || entry?.path || '')).length;
  return {
    projects: project?.id ? 1 : 0,
    rooms: rooms.length,
    measurementProtocols: protocols.length,
    measurementValues,
    images: collectImages(project).length,
    deviceChanges: devices.length,
    todos: todos.length,
    pdfs,
  };
}

export function compareProjectSyncContent(localProject, cloudProject) {
  const expected = countProjectSyncContent(localProject);
  const confirmed = countProjectSyncContent(cloudProject);
  const countMismatches = Object.keys(expected).filter((key) => expected[key] !== confirmed[key]);
  const expectedCanonical = canonicalProjectContent(localProject);
  const confirmedCanonical = canonicalProjectContent(cloudProject);
  const contentMismatches = diffCanonical(expectedCanonical, confirmedCanonical);
  const mismatches = [...new Set([...countMismatches, ...contentMismatches])];
  return {
    expected,
    confirmed,
    verified: mismatches.length === 0,
    mismatches,
    canonical: {
      expected: expectedCanonical,
      confirmed: confirmedCanonical,
    },
  };
}

// Values created by the browser or the transport are deliberately excluded.
// Business fields (including text, versions and tombstones) are never excluded.
const VOLATILE_KEYS = new Set([
  '_supabase_updated_at', 'created_at', 'updated_at', 'createdAt', 'updatedAt',
  'uploading', 'syncStatus', 'error', 'errorMessage', 'retryCount',
  'isLightweight', 'localOnly', 'blob', 'file', 'objectUrl',
]);
const MEDIA_URL_KEYS = new Set(['preview', 'url', 'publicUrl', 'downloadUrl']);
const MEDIA_PROVIDER_KEYS = new Set([
  'storagePath', 'supabasePath', 'supabaseBackedUpAt',
  'oneDriveItemId', 'oneDrivePath', 'oneDriveSha256', 'oneDriveVerifiedAt',
]);
const REPORT_ENVELOPE_KEYS = new Set([
  'id', 'report_data', '_offlineMaterialization', '_supabase_updated_at',
  'isLightweight', '_is_offline_fallback',
]);

const isMediaLike = (value) => Boolean(value && typeof value === 'object' && (
  value.storagePath || value.supabasePath || value.oneDriveItemId || value.checksum ||
  value.sha256 || /\.(jpe?g|png|webp|heic|pdf)(\?|$)/i.test(value.name || '') ||
  /^data:image\//i.test(value.preview || value.url || '') || /^blob:/i.test(value.preview || value.url || '')
));

function stableKey(value, fallback) {
  if (!value || typeof value !== 'object') return `${typeof value}:${String(value)}`;
  return String(value.id ?? value.entityId ?? value.roomId ?? value.mpNumber ??
    value.storagePath ?? value.supabasePath ?? value.oneDriveItemId ?? value.name ?? fallback);
}

function canonicalise(value, path = '$') {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((entry, index) => canonicalise(entry, `${path}[${index}]`))
      .sort((left, right) => stableKey(left, JSON.stringify(left)).localeCompare(stableKey(right, JSON.stringify(right))));
  }
  const media = isMediaLike(value);
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (VOLATILE_KEYS.has(key)) continue;
    // Provider representations/evidence are checked independently by fresh
    // Storage byte readback and the OneDrive journal. They must not make the
    // business JSON comparison differ merely because sync enriched the cloud
    // object after the immutable local snapshot was taken.
    if (media && MEDIA_URL_KEYS.has(key)) continue;
    if (media && MEDIA_PROVIDER_KEYS.has(key)) continue;
    const child = value[key];
    if (typeof child === 'function' || child === undefined) continue;
    result[key] = canonicalise(child, `${path}.${key}`);
  }
  return result;
}

export function canonicalProjectContent(project = {}) {
  return canonicalise(project);
}

/**
 * Convert the UI/session envelope into the exact JSON document persisted in
 * damage_reports.report_data.  A loaded project contains DB envelope fields
 * and a separately materialised relational cache; neither is part of the
 * report_data JSONB value and comparing it to JSONB creates false matches or
 * false mismatches. The current merged UI fields are authoritative (a nested
 * report_data member can be an old load-time copy), so only known envelope
 * fields are removed and every business field is retained.
 */
export function projectReportDataProjection(project = {}) {
  const source = project;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source)
    .filter(([key]) => !REPORT_ENVELOPE_KEYS.has(key)));
}

export function compareProjectReportData(localSessionSnapshot, cloudReportData) {
  return compareProjectSyncContent(
    projectReportDataProjection(localSessionSnapshot),
    projectReportDataProjection(cloudReportData),
  );
}

function diffCanonical(expected, actual, path = '$', mismatches = [], limit = 100) {
  if (mismatches.length >= limit) return mismatches;
  if (Object.is(expected, actual)) return mismatches;
  if (typeof expected !== typeof actual || expected == null || actual == null) {
    mismatches.push(path);
    return mismatches;
  }
  if (typeof expected !== 'object') {
    mismatches.push(path);
    return mismatches;
  }
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);
  for (const key of new Set([...expectedKeys, ...actualKeys])) {
    if (!(key in expected) || !(key in actual)) mismatches.push(`${path}.${key}`);
    else diffCanonical(expected[key], actual[key], `${path}.${key}`, mismatches, limit);
    if (mismatches.length >= limit) break;
  }
  return mismatches;
}

export function formatProjectSyncCounts(counts = {}) {
  const labels = [
    ['projects', 'Projekt'], ['rooms', 'Räume'], ['measurementProtocols', 'Messprotokolle'],
    ['measurementValues', 'Messwerte'], ['images', 'Bilder'], ['deviceChanges', 'Geräte'],
    ['todos', 'To-dos'], ['pdfs', 'PDF'],
  ];
  return labels.filter(([key]) => Number(counts[key] || 0) > 0)
    .map(([key, label]) => `${Number(counts[key])} ${label}`);
}
