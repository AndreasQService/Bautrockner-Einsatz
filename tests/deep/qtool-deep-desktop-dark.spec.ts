import { test, expect } from '@playwright/test';
import { captureAuditScreenshot } from './helpers/screenshotHelper';

test.describe('QTool Deep Desktop Dark Mode', () => {
  test.use({ colorScheme: 'dark' });

  test('Complete Page Audit - Dark Mode', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:5173');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    
    await page.waitForTimeout(2000);
    await captureAuditScreenshot(page, 'desktop-dark-dashboard');
    
    const firstProject = page.locator('.project-row, a:has-text("P-"), button:has-text("P-")').first();
    if (await firstProject.isVisible()) {
      await firstProject.click();
      await page.waitForTimeout(2000);
      await captureAuditScreenshot(page, 'desktop-dark-project-details');
    }
  });
});
