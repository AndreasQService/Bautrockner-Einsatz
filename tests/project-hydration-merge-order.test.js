import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('full project hydration keeps database measurement data over lightweight placeholders', () => {
  assert.doesNotMatch(
    appSource,
    /\.\.\.sanitizeMeasurementStorage\(mergedData\),\s+\.\.\.(?:activeReport|selectedReport),/,
    'Lightweight project data must not overwrite hydrated equipment or measurementRooms'
  );

  assert.match(
    appSource,
    /\.\.\.activeReport,\s+\.\.\.sanitizeMeasurementStorage\(mergedData\),/,
    'Active project hydration must apply complete database data last'
  );

  assert.match(
    appSource,
    /\.\.\.selectedReport,\s+\.\.\.sanitizeMeasurementStorage\(mergedData\),/,
    'Selected project hydration must apply complete database data last'
  );
});
