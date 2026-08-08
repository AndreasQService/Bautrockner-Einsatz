import test from 'node:test';
import assert from 'node:assert/strict';

import { isTechnicalProjectRow, isVisibleProjectRow } from '../src/utils/projectVisibility.js';

test('filters SYSTEM_SETTINGS and technical session rows', () => {
  const technicalRows = [
    { id: 'SYSTEM_SETTINGS' },
    { id: 'system_settings' },
    { id: '__session__' },
    { id: 'session_123' },
    { id: '__session_desktop' },
    { id: 'real-id', projectTitle: '__session__' },
    { id: 'real-id', project_title: 'session_ipad' },
    { id: 'real-id', report_data: { projectTitle: '__session_worker' } },
    { id: 'real-id', report_data: { id: 'session_nested' } },
  ];

  for (const row of technicalRows) {
    assert.equal(isTechnicalProjectRow(row), true, JSON.stringify(row));
    assert.equal(isVisibleProjectRow(row), false, JSON.stringify(row));
  }
});

test('keeps real projects, including ordinary titles containing session', () => {
  const projects = [
    { id: '2026-001', projectTitle: 'Sessionsraum renovieren' },
    { id: 'a-session-project', projectTitle: 'Wasserschaden' },
  ];

  for (const project of projects) {
    assert.equal(isVisibleProjectRow(project), true, JSON.stringify(project));
  }
});

test('rejects malformed empty rows defensively', () => {
  assert.equal(isVisibleProjectRow(null), false);
  assert.equal(isVisibleProjectRow(undefined), false);
});