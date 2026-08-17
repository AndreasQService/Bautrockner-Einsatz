import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

test.describe('REAL BROWSER PWA STORAGE & SW UPDATE E2E SUITE', () => {
  const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5180';

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('1. Storage Persistence & Quota Verification in Real Browser Context', async ({ page }) => {
    const storageResult = await page.evaluate(async () => {
      const { ensurePersistentStorage, getStorageQuota } = await import('/src/lib/offline/storagePersistence.js');
      const isPersisted = await ensurePersistentStorage();
      const quota = await getStorageQuota();
      return { isPersisted, quota };
    });

    expect(typeof storageResult.isPersisted).toBe('boolean');
    expect(typeof storageResult.quota.quota).toBe('number');
    expect(typeof storageResult.quota.usage).toBe('number');
    expect(typeof storageResult.quota.percentUsed).toBe('number');
  });

  test('2. Real PWA Banner UI Display & Click Verification', async ({ page }) => {
    await login(page);

    // Dispatch SW update event to trigger UI Banner mount
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('qtool:sw-update-available'));
    });

    // Assert that the banner "Neue QTool-Version verfügbar" is visible in the DOM
    const updateBannerText = page.locator('text=Neue QTool-Version verfügbar');
    await expect(updateBannerText).toBeVisible({ timeout: 10000 });

    // Assert "Aktualisieren" button is visible and click it using real Playwright locator click
    const updateBtn = page.locator('button', { hasText: 'Aktualisieren' }).first();
    await expect(updateBtn).toBeVisible();

    // Catch any uncaught page errors
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // Click "Aktualisieren" button
    await updateBtn.click();
    await page.waitForTimeout(500);

    // Verify no uncaught exceptions occurred during update trigger
    expect(pageErrors.length).toBe(0);
  });
});
