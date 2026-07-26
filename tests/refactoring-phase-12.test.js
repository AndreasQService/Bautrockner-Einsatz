import test from 'node:test';
import assert from 'node:assert/strict';

import { PROJECT_LIST_PALETTE } from '../src/config/projectListConfig.js';

const expectedPalette = {
  red:    { bg: 'rgba(239,68,68,0.06)',  hover: 'rgba(239,68,68,0.11)',  strip: '#EF4444', dot: '#EF4444', badge: 'rgba(239,68,68,0.18)',  badgeBorder: 'rgba(239,68,68,0.4)',  badgeText: '#FCA5A5', reasonC: '#FCA5A5', label: '🔴 Kritisch'  },
  yellow: { bg: 'rgba(245,158,11,0.04)', hover: 'rgba(245,158,11,0.09)', strip: '#F59E0B', dot: '#F59E0B', badge: 'rgba(245,158,11,0.15)', badgeBorder: 'rgba(245,158,11,0.35)', badgeText: '#FCD34D', reasonC: '#FCD34D', label: '🟡 Verzögert' },
  green:  { bg: 'transparent',           hover: 'rgba(255,255,255,0.03)', strip: '#10B981', dot: '#10B981', badge: 'rgba(16,185,129,0.12)', badgeBorder: 'rgba(16,185,129,0.25)', badgeText: '#6EE7B7', reasonC: '#64748B', label: '🟢 OK'        },
};

test('PROJECT_LIST_PALETTE preserves status order and every display value', () => {
  assert.deepEqual(PROJECT_LIST_PALETTE, expectedPalette);
  assert.deepEqual(Object.keys(PROJECT_LIST_PALETTE), ['red', 'yellow', 'green']);
});

test('PROJECT_LIST_PALETTE is not mutated by characterization', () => {
  const before = structuredClone(PROJECT_LIST_PALETTE);
  assert.deepEqual(PROJECT_LIST_PALETTE, before);
});
