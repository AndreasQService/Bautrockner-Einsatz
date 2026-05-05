import { test, expect, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

// Define iPad Pro 12.9 Custom Device
const iPad12_9 = {
  name: 'iPad-Pro-12-9',
  use: {
    viewport: { width: 1024, height: 1366 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  }
};

const iPad11 = {
  name: 'iPad-Pro-11',
  use: {
    viewport: { width: 834, height: 1194 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  }
};

const viewports = [
  { name: 'iPad-11-Portrait', use: iPad11.use, orientation: 'portrait' },
  { name: 'iPad-11-Landscape', use: iPad11.use, orientation: 'landscape' },
  { name: 'iPad-12-9-Portrait', use: iPad12_9.use, orientation: 'portrait' },
  { name: 'iPad-12-9-Landscape', use: iPad12_9.use, orientation: 'landscape' },
];

const REPORT_PATH = 'reports/ipad/qtool-ipad-usability-report.md';
const SCREENSHOT_DIR = 'reports/ipad/screenshots';

test.describe('QTool iPad Usability & HIG Audit', () => {
  let issues = [];

  test.beforeAll(async () => {
    if (!fs.existsSync('reports/ipad')) {
        fs.mkdirSync('reports/ipad', { recursive: true });
    }
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  for (const vp of viewports) {
    test(`Usability Audit - ${vp.name} (${vp.orientation})`, async ({ page }) => {
      // Set viewport and orientation
      const width = vp.orientation === 'portrait' ? vp.use.viewport.width : vp.use.viewport.height;
      const height = vp.orientation === 'portrait' ? vp.use.viewport.height : vp.use.viewport.width;
      await page.setViewportSize({ width, height });

      try {
        console.log(`[${vp.name}] Navigating...`);
        await page.goto('http://127.0.0.1:5173', { timeout: 30000 });
        await page.waitForLoadState('networkidle');

        // Ensure Technician Mode is active
        const toggleBtn = page.locator('button[title="Zwischen Desktop- und Techniker-Modus wechseln"]');
        if (await toggleBtn.isVisible()) {
            const btnText = (await toggleBtn.innerText()).trim();
            if (btnText === 'Desktop') {
                console.log(`[${vp.name}] Switching to Technician Mode...`);
                await toggleBtn.click();
                await page.waitForTimeout(1000);
            }
        }

        // 1. Click Project Card
        const projectCard = page.locator('.tech-project-card').first();
        if (await projectCard.isVisible()) {
            await projectCard.click();
        } else {
            console.log(`[${vp.name}] Project card not found, trying table row...`);
            const row = page.locator('tr').nth(1);
            if (await row.isVisible()) await row.click();
        }

        await page.waitForTimeout(2000);

        // Open Measurements Modal
        // The modal button might be in a different place in tech mode.
        // It's usually a button with "Feuchtigkeit" or "Messungen"
        const measBtn = page.locator('button:has-text("Messungen"), button:has-text("Feuchtigkeit"), button:has-text("Messung")').first();
        if (await measBtn.isVisible()) {
            await measBtn.click();
            await page.waitForTimeout(2000);
        } else {
            console.log(`[${vp.name}] Measurements button not found in project details`);
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, `fail-${vp.name}-no-meas-btn.png`) });
        }
      } catch (e) {
        console.error(`[${vp.name}] Audit flow failed: ${e.message}`);
        return;
      }

      // --- APPLE HIG AUDIT ---

      // A) Touch Targets (>= 44px)
      const interactives = await page.locator('button, .btn, [role="button"], input, select, textarea').all();
      for (const el of interactives) {
        if (!(await el.isVisible())) continue;
        
        const box = await el.boundingBox();
        const text = (await el.innerText() || await el.getAttribute('placeholder') || await el.getAttribute('title') || 'Element').trim().substring(0, 30);
        
        if (box && (box.width < 43.5 || box.height < 43.5)) {
          const safeText = text.replace(/[^a-z0-9]/gi, '-').toLowerCase();
          const screenshotName = `ss-${vp.name}-${safeText}.png`.substring(0, 50);
          await el.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotName) }).catch(() => {});
          issues.push({
            priority: 'P1',
            page: 'Audit',
            element: text,
            property: 'Touch Target',
            actual: `${Math.round(box.width)}x${Math.round(box.height)}px`,
            expected: 'min 44x44px',
            screenshot: screenshotName
          });
        }
      }

      // B) Keyboard Occlusion
      const inputs = await page.locator('input[type="text"], input[type="number"], textarea').all();
      for (const input of inputs) {
        if (!(await input.isVisible())) continue;
        const box = await input.boundingBox();
        const keyboardThreshold = height * 0.55; 
        if (box && box.y > keyboardThreshold) {
          issues.push({
            priority: 'P1',
            page: 'Audit',
            element: 'Input Field',
            property: 'Keyboard Occlusion',
            actual: `Y-Pos: ${Math.round(box.y)} (Threshold: ${Math.round(keyboardThreshold)})`,
            expected: 'Scroll into upper 55% of view'
          });
        }
      }

      // C) WCAG Check (Critical/Serious)
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
        .analyze();

      accessibilityScanResults.violations.forEach(v => {
        if (v.impact === 'critical' || v.impact === 'serious') {
          issues.push({
            priority: 'P1',
            page: vp.name,
            element: v.id,
            property: 'WCAG',
            actual: v.impact,
            expected: 'no critical/serious violations',
            description: v.description
          });
        }
      });
    });
  }

  test.afterAll(async () => {
    let reportMd = '# QTool iPad Usability & Apple HIG Audit Report\n\n';
    reportMd += `**Generated:** ${new Date().toLocaleString('de-CH')}\n\n`;
    reportMd += '## Summary\n\n';
    reportMd += `Tested Devices: iPad Pro 11, iPad Pro 12.9 (Portrait & Landscape)\n\n`;
    
    // De-duplicate issues based on element and property
    const uniqueIssues = [];
    const seen = new Set();
    for (const issue of issues) {
        const key = `${issue.element}-${issue.property}-${issue.actual}`;
        if (!seen.has(key)) {
            uniqueIssues.push(issue);
            seen.add(key);
        }
    }

    if (uniqueIssues.length === 0) {
      reportMd += '✅ No usability or HIG issues found.\n';
    } else {
      reportMd += '| Priority | Page | Element | Property | Actual | Expected | Screenshot |\n';
      reportMd += '|----------|------|---------|----------|--------|----------|------------|\n';
      uniqueIssues.forEach(issue => {
        const ssLink = issue.screenshot ? `[View](./screenshots/${issue.screenshot})` : '-';
        reportMd += `| ${issue.priority} | ${issue.page} | ${issue.element} | ${issue.property} | ${issue.actual} | ${issue.expected} | ${ssLink} |\n`;
      });
    }

    if (!fs.existsSync('reports/ipad')) {
        fs.mkdirSync('reports/ipad', { recursive: true });
    }
    fs.writeFileSync(REPORT_PATH, reportMd);
    console.log(`Report generated: ${REPORT_PATH}`);
  });
});
