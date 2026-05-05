import { test, expect } from '@playwright/test';
import { DESIGN_TOKENS, isAllowedColor } from './helpers/designTokens';
import { openAllSafeUiStates } from './helpers/openAllSafeUiStates';
import { captureAuditScreenshot } from './helpers/screenshotHelper';
import * as fs from 'fs';

const REPORT_PATH = 'reports/deep/qtool-design-outliers.md';

test.describe('QTool Deep Design Audit', () => {
  let outliers: any[] = [];

  test.afterAll(async () => {
    let report = '# QTool Design Outliers Report\n\n';
    report += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    report += '| Priority | Page | Element | Property | Actual | Expected | Screenshot |\n';
    report += '|----------|------|---------|----------|--------|----------|------------|\n';
    
    for (const o of outliers) {
      // Use forward slashes for markdown links
      const ssLink = o.screenshot.replace(/\\/g, '/');
      report += `| ${o.priority} | ${o.page} | ${o.element} | ${o.property} | \`${o.actual}\` | \`${o.expected}\` | [View](../../${ssLink}) |\n`;
    }
    
    fs.writeFileSync(REPORT_PATH, report);
  });

  async function scanPage(page: any, pageName: string, isMobile: boolean) {
    await page.waitForTimeout(1000); // Wait for content
    await openAllSafeUiStates(page);
    
    const selectors = ['button', 'input', 'select', 'textarea', '.project-row', '.card', '.tech-project-card'];
    for (const selector of selectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      for (let i = 0; i < Math.min(count, 15); i++) {
        const el = elements.nth(i);
        if (!(await el.isVisible())) continue;

        const styles = await el.evaluate((node) => {
          const s = window.getComputedStyle(node);
          return {
            backgroundColor: s.backgroundColor,
            color: s.color,
            borderRadius: s.borderRadius,
            height: s.height,
            fontSize: s.fontSize
          };
        });

        const text = (await el.innerText().catch(() => '')).trim().slice(0, 20);
        const elName = `${selector}${text ? ` [${text}]` : ''}`;

        // Radius Check
        const radiusVal = parseInt(styles.borderRadius);
        if (radiusVal > 6 && !text.includes('Badge') && !selector.includes('badge') && !text.includes('Status')) {
          const ss = await captureAuditScreenshot(el, `design-${pageName}-${selector}-${i}-radius`);
          outliers.push({
            priority: 'P3', page: pageName, element: elName,
            property: 'borderRadius', actual: styles.borderRadius, expected: 'max 6px',
            screenshot: ss
          });
        }

        // Height Check
        const heightVal = parseInt(styles.height);
        const minHeight = isMobile ? 44 : 36;
        if ((selector === 'button' || selector === 'input') && heightVal < minHeight && heightVal > 0) {
          const ss = await captureAuditScreenshot(el, `design-${pageName}-${selector}-${i}-height`);
          outliers.push({
            priority: 'P1', page: pageName, element: elName,
            property: 'height', actual: styles.height, expected: `min ${minHeight}px`,
            screenshot: ss
          });
        }
      }
    }
  }

  test('Comprehensive Design Audit - All Pages', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('.app', { timeout: 10000 });
    
    // 1. Dashboard
    await scanPage(page, 'Dashboard', false);
    
    // 2. Project Detail (find any project row or P- link)
    const firstProject = page.locator('.project-row, a:has-text("P-"), button:has-text("P-")').first();
    if (await firstProject.isVisible()) {
      await firstProject.click();
      await page.waitForTimeout(2000);
      await scanPage(page, 'ProjectDetail', false);
      
      // Try to open a modal
      const modalTrigger = page.locator('button:has-text("Export"), button:has-text("Mail"), button:has-text("Neu")').first();
      if (await modalTrigger.isVisible()) {
         await modalTrigger.click();
         await page.waitForTimeout(1000);
         await scanPage(page, 'ModalView', false);
         await page.keyboard.press('Escape');
      }
    }
  });
});
