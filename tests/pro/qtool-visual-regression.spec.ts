import { test, expect, devices } from '@playwright/test';

const viewports = [
  { name: 'Desktop-Light', viewport: { width: 1440, height: 900 }, theme: 'light' },
  { name: 'Desktop-Dark', viewport: { width: 1440, height: 900 }, theme: 'dark' },
  { name: 'iPad-Pro-11-Portrait', ...devices['iPad Pro 11'], orientation: 'portrait' },
  { name: 'iPad-Pro-12-9-Landscape', ...devices['iPad Pro 12.9'], orientation: 'landscape' },
];

test.describe('QTool Pro: Visual Regression', () => {
  for (const vp of viewports) {
    test(`Snapshot: ${vp.name}`, async ({ page }) => {
      // Set viewport
      if ('viewport' in vp) {
        await page.setViewportSize(vp.viewport);
      }
      
      await page.goto('http://127.0.0.1:5173');
      await page.waitForLoadState('networkidle');

      // Set Theme
      const isDarkMode = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark');
      if (vp.theme === 'dark' && !isDarkMode) {
        await page.locator('#dark-mode-toggle').click();
      } else if (vp.theme === 'light' && isDarkMode) {
        await page.locator('#dark-mode-toggle').click();
      }
      await page.waitForTimeout(500);

      // 1. Dashboard Snapshot
      await expect(page).toHaveScreenshot(`dashboard-${vp.name}.png`, {
        fullPage: true,
        mask: [page.locator('.status-badge')] // Mask dynamic status tags to avoid false positives
      });

      // 2. Project Details Snapshot (if project exists)
      const projectCard = page.locator('.tech-project-card, tr').first();
      if (await projectCard.isVisible()) {
        await projectCard.click();
        await page.waitForTimeout(1000);
        await expect(page).toHaveScreenshot(`project-details-${vp.name}.png`, { fullPage: true });
        
        // 3. Measurement Modal Snapshot
        const measBtn = page.locator('button:has-text("Messungen"), button:has-text("Feuchtigkeit")').first();
        if (await measBtn.isVisible()) {
          await measBtn.click();
          await page.waitForTimeout(1000);
          await expect(page).toHaveScreenshot(`measurement-modal-${vp.name}.png`);
        }
      }
    });
  }
});
