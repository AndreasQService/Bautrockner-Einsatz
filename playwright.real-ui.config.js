import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

function requireSecureStorageState() {
  const configured = process.env.QTOOL_UI_STORAGE_STATE;
  if (!configured || !path.isAbsolute(configured)) {
    throw new Error('QTOOL_UI_STORAGE_STATE must be an explicit absolute path outside the repository.');
  }
  const resolved = fs.realpathSync(configured);
  const repository = fs.realpathSync(process.cwd());
  if (resolved === repository || resolved.startsWith(`${repository}${path.sep}`)) {
    throw new Error('Authenticated browser state must not be stored inside the repository.');
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || (stat.mode & 0o077) !== 0) {
    throw new Error('Authenticated browser state must be a regular file readable only by its owner (mode 0600).');
  }
  return resolved;
}

const storageState = requireSecureStorageState();

export default defineConfig({
  testDir: './tests/real-ui',
  timeout: 3 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-real-ui', open: 'never' }]],
  use: {
    baseURL: 'https://qtool-test.vercel.app',
    storageState,
    ...devices['Desktop Chrome'],
    locale: 'de-CH',
    // Playwright traces can contain Authorization headers and localStorage tokens.
    trace: 'off',
    screenshot: 'on',
    video: 'on',
  },
  projects: [{ name: 'qtool-test-chromium', use: { browserName: 'chromium' } }],
});
