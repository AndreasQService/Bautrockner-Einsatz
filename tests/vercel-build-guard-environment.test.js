import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guardPath = path.join(repoRoot, 'scripts', 'vercel-build-guard.cjs');

function runGuard(overrides) {
  const env = { ...process.env, ...overrides };
  delete env.QTOOL_ENVIRONMENT;
  delete env.VITE_QTOOL_ENVIRONMENT;
  delete env.ONEDRIVE_TEST_ROOT;
  delete env.VITE_ONEDRIVE_TEST_ROOT;

  return spawnSync(process.execPath, [guardPath], {
    cwd: repoRoot,
    env,
    encoding: 'utf8'
  });
}

test('live production build does not load preview-only safety defaults', () => {
  const result = runGuard({
    VERCEL: '1',
    VERCEL_ENV: 'production',
    VERCEL_PROJECT_NAME: 'bautrockner-einsatz',
    VITE_EXPECTED_SUPABASE_PROJECT_ID: 'yxdoecdqttgdncgbzyus',
    VITE_SUPABASE_URL: 'https://yxdoecdqttgdncgbzyus.supabase.co'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stdout, /QTOOL_ENVIRONMENT:\s*'test'/);
  assert.doesNotMatch(result.stdout, /VITE_ONEDRIVE_TEST_ROOT:\s*'QTool_TEST_ONLY'/);
  assert.match(result.stdout, /All pre-build security checks passed successfully/);
});

test('qtool-test production build still loads mandatory preview safety defaults', () => {
  const result = runGuard({
    VERCEL: '1',
    VERCEL_ENV: 'production',
    VERCEL_PROJECT_NAME: 'qtool-test',
    VITE_EXPECTED_SUPABASE_PROJECT_ID: 'aoxduqspiezzyqeqyzzl',
    VITE_SUPABASE_URL: 'https://aoxduqspiezzyqeqyzzl.supabase.co'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /QTOOL_ENVIRONMENT:\s*'test'/);
  assert.match(result.stdout, /VITE_ONEDRIVE_TEST_ROOT:\s*'QTool_TEST_ONLY'/);
  assert.match(result.stdout, /All pre-build security checks passed successfully/);
});
