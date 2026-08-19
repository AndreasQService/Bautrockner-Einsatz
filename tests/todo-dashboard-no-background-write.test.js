import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/services/TodoService.js', import.meta.url), 'utf8');
const fetchStart = source.indexOf('export async function fetchAllTodos');
const fetchEnd = source.indexOf('\nexport ', fetchStart + 1);
const fetchBody = source.slice(fetchStart, fetchEnd === -1 ? source.length : fetchEnd);

test('dashboard todo loading never performs background cloud mutations', () => {
  assert.ok(fetchStart >= 0, 'fetchAllTodos must exist');
  assert.doesNotMatch(fetchBody, /from\(['"]project_todos['"]\)\s*\.insert\s*\(/);
  assert.doesNotMatch(fetchBody, /from\(['"]project_todos['"]\)\s*\.upsert\s*\(/);
  assert.doesNotMatch(fetchBody, /from\(['"]project_todos['"]\)\s*\.delete\s*\(/);
  assert.match(fetchBody, /Keep the local evidence intact/);
});
