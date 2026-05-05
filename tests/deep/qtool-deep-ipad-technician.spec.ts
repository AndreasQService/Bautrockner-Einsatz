import { test, expect } from '@playwright/test';
import { captureAuditScreenshot } from './helpers/screenshotHelper';

test.use({
  viewport: { width: 834, height: 1194 },
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.8 Mobile/15E148 Safari/604.1',
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'dark',
});

test.describe('QTool Deep iPad Technician Mode', () => {
  test('Technician Workflow Audit', async ({ page }) => {
    // iPad Landscape
    await page.setViewportSize({ width: 1194, height: 834 });
    await page.goto('http://localhost:5173');
    
    // 1. Enter Technician Mode
    const techToggle = page.locator('button:has-text("Techniker"), .btn-primary:has-text("Techniker")').first();
    if (await techToggle.isVisible()) {
       await techToggle.click();
    }
    await page.waitForTimeout(2000);
    await captureAuditScreenshot(page, 'ipad-landscape-tech-dashboard');

    // 2. Open first project in tech mode
    const techProject = page.locator('.tech-project-card, .project-row, button:has-text("P-")').first();
    if (await techProject.isVisible()) {
      await techProject.click();
      await page.waitForTimeout(1500);
      await captureAuditScreenshot(page, 'ipad-landscape-tech-project-overview');
      
      // 3. Navigate through tech tabs
      const techTabs = ['Übersicht', 'Aufnahme', 'Leck', 'Trocknung', 'Messung'];
      for (const tab of techTabs) {
        const tabBtn = page.locator(`button:has-text("${tab}"), .tech-tab-item:has-text("${tab}")`).first();
        if (await tabBtn.isVisible()) {
           await tabBtn.click();
           await page.waitForTimeout(800);
           await captureAuditScreenshot(page, `ipad-landscape-tech-tab-${tab.toLowerCase()}`);
        }
      }
    }

    // 4. Portrait Check
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.waitForTimeout(800);
    await captureAuditScreenshot(page, 'ipad-portrait-tech-dashboard');
  });
});
