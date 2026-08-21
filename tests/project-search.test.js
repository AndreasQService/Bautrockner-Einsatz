import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectSearchText, projectMatchesSearch } from '../src/lib/projectSearch.js';

test('sidebar search finds every project whose visible street contains the query', () => {
  const reports = [
    { id: '1', projectNumber: '20260405', address: 'Brandbachstrasse 10, 8305 Dietlikon' },
    { id: '2', projectNumber: '20260435', street: 'Brandachstrasse 10', zip: '8305', city: 'Dietlikon' },
  ];

  assert.deepEqual(
    reports.filter(report => projectMatchesSearch(report, 'brand')).map(report => report.projectNumber),
    ['20260405', '20260435'],
  );
});

test('search supports the known project fields from nested report_data', () => {
  const report = {
    id: '3',
    report_data: {
      projectNumber: '20269999',
      street: 'Sonnenbergstrasse 24',
      zip: '8708',
      city: 'Männedorf',
    },
  };

  assert.equal(projectMatchesSearch(report, 'sonnenberg'), true);
  assert.equal(projectMatchesSearch(report, 'mannedorf'), true);
  assert.equal(projectMatchesSearch(report, '20269999'), true);
});

test('search corpus excludes technical metadata and unrelated object contents', () => {
  const report = {
    projectNumber: '20260001',
    street: 'Testweg 1',
    syncMetadata: { previousAddress: 'Brandbachstrasse' },
    report_data: { internalDebugValue: 'brand-secret' },
  };

  assert.equal(projectMatchesSearch(report, 'brand'), false);
  assert.equal(getProjectSearchText(report).includes('brand-secret'), false);
});
