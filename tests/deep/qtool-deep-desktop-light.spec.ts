import { test, expect } from '@playwright/test';
import { captureAuditScreenshot } from './helpers/screenshotHelper';

test.describe('QTool Deep Desktop Light Mode', () => {
  test.use({ colorScheme: 'light' });

  test('Complete Page Audit - Light Mode', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('http://localhost:5173');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    
    // 1. Dashboard
    await page.waitForTimeout(2000);
    await captureAuditScreenshot(page, 'desktop-light-dashboard');
    
    // 2. Open a Project
    const firstProject = page.locator('.project-row, a:has-text("P-"), button:has-text("P-")').first();
    if (await firstProject.isVisible()) {
      await firstProject.click();
      await page.waitForTimeout(2000);
      await captureAuditScreenshot(page, 'desktop-light-project-details');
      
      // Navigate tabs in project detail
      const tabs = ['Schadenaufnahme', 'Leckortung', 'Trocknung', 'Messung'];
      for (const tab of tabs) {
        const tabBtn = page.locator(`button:has-text("${tab}"), .tech-tab-item:has-text("${tab}")`).first();
        if (await tabBtn.isVisible()) {
           await tabBtn.click();
           await page.waitForTimeout(800);
           await captureAuditScreenshot(page, `desktop-light-tab-${tab.toLowerCase()}`);
        }
      }
    }
  });
});
