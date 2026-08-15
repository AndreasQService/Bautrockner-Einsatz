import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('UploadPanel has no direct Supabase business writes', async () => {
  const source = await read('src/components/UploadPanel.jsx');
  assert.doesNotMatch(source, /supabase\.storage/);
  assert.doesNotMatch(source, /\.from\(["']damage_reports["']\)/);
  assert.doesNotMatch(source, /\.from\(["']case_documents["']\)/);
  assert.doesNotMatch(source, /supabase\.functions\.invoke/);
  assert.match(source, /registerMediaLocally/);
  assert.match(source, /registerCaseDocumentLocally/);
});

test('legacy useDamageForm hook is not imported by runtime source', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync('rg', [
    '-l', 'useDamageForm', 'src',
    '--glob', '!hooks/useDamageForm.js',
    '--glob', '!**/*2026*',
    '--glob', '!**/%TIMESTAMP%*',
  ]).catch((error) => ({ stdout: error.stdout || '' }));
  const runtimeImporters = stdout.split(/\r?\n/)
    .filter(Boolean)
    .filter((path) => path !== 'src/hooks/useDamageForm.js');
  assert.deepEqual(runtimeImporters, []);
});
