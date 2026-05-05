import { test, expect, devices } from '@playwright/test';
import { DESIGN_TOKENS } from './qtool-design-tokens';
import * as fs from 'fs';
import * as path from 'path';

/**
 * QTool Design Audit
 * Scans for UI outliers: wrong colors, radii, sizes, etc.
 */

const VIEWPORTS = [
  { name: 'Desktop-Light', width: 1440, height: 900, mode: 'light', isMobile: false },
  { name: 'iPad-Pro-11', width: 834, height: 1194, mode: 'technician', isMobile: true },
  { name: 'iPad-Pro-12.9', width: 1024, height: 1366, mode: 'technician', isMobile: true },
];

const REPORT_DIR = 'reports/design';
const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots');

// Ensure directories exist
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface DesignOutlier {
  page: string;
  element: string;
  selector: string;
  property: string;
  actual: string;
  expected: string;
  screenshot: string;
  priority: 'P1' | 'P2' | 'P3';
}

const outliers: DesignOutlier[] = [];

test.describe('QTool Design Token Audit', () => {

  for (const vp of VIEWPORTS) {
    test(`Audit for ${vp.name}`, async ({ page }) => {
      // Set viewport
      await page.setViewportSize({ width: vp.width, height: vp.height });
      
      // 1. Navigate and Setup Mode
      await page.goto('http://localhost:5173');
      await page.waitForLoadState('domcontentloaded');
      
      // Wait for app to be ready
      await page.waitForSelector('button, .tech-project-card, .project-card, h1', { timeout: 15000 });
      
      // Take a debug screenshot
      await page.screenshot({ path: `reports/design/debug-${vp.name}.png` });

      // Set Theme
      await page.evaluate((mode) => {
        document.documentElement.setAttribute('data-theme', mode === 'light' ? 'light' : 'dark');
      }, vp.mode);

      // Switch to Technician mode if needed
      if (vp.mode === 'technician') {
        const modeToggle = page.locator('header button:has-text("Desktop"), header button:has-text("Techniker")');
        if (await modeToggle.isVisible()) {
          const text = await modeToggle.innerText();
          if (text.includes('Desktop')) {
            await modeToggle.click();
            await page.waitForTimeout(1000);
          }
        }
      }

      // 2. Scan Elements
      // We'll scan Dashboard and then a project
      await scanCurrentView(page, vp.name, 'Dashboard');

      // Open a project to scan DamageForm
      const projectCard = page.locator('.tech-project-card, .project-card, tr').first();
      if (await projectCard.isVisible()) {
        await projectCard.click();
        await page.waitForTimeout(1000);
        await scanCurrentView(page, vp.name, 'ProjectView');

        // 2b. Open a Modal (e.g., Email Import or any button that opens a dialog)
        const emailImportBtn = page.locator('button:has-text("Import"), button .lucide-download').first();
        if (await emailImportBtn.isVisible()) {
            await emailImportBtn.click();
            await page.waitForTimeout(1000);
            await scanCurrentView(page, vp.name, 'EmailModal');
            // Close modal
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        }
      }

      // 3. Generate Report Fragment
      generateReport();
    });
  }
});

async function scanCurrentView(page, vpName: string, viewName: string) {
  console.log(`Scanning ${viewName} on ${vpName}...`);
  
  // Selectors to audit
  const selectors = [
    'button', 'a', 'input', 'select', 'textarea', 
    '.card', '.tech-project-card', '.project-card', '.modal-content',
    '[role="tab"]', '.badge'
  ];

  for (const selector of selectors) {
    // Ensure we wait for the selector to at least potentially exist
    const elements = page.locator(selector);
    const count = await elements.count();
    console.log(`- Found ${count} elements for selector: ${selector}`);
    
    for (let i = 0; i < Math.min(count, 30); i++) {
      const el = elements.nth(i);
      if (!(await el.isVisible())) continue;

      const styles = await el.evaluate((node) => {
        const s = window.getComputedStyle(node);
        return {
          backgroundColor: s.backgroundColor,
          color: s.color,
          borderColor: s.borderColor,
          borderRadius: s.borderRadius,
          fontSize: s.fontSize,
          height: s.height,
          padding: s.padding,
          boxShadow: s.boxShadow
        };
      });

      const text = (await el.innerText()).substring(0, 20);
      const uniqueId = `${viewName}-${selector.replace(/[^a-z]/g, '')}-${i}`;

      // Check Buttons
      if (selector === 'button' || selector === 'a') {
        await validateButton(styles, text, selector, i, viewName, vpName, el, page, uniqueId);
      }

      // Check Radius
      if (styles.borderRadius !== '0px' && styles.borderRadius !== '50%') {
        const radiusVal = parseInt(styles.borderRadius);
        if (radiusVal > 6 && !selector.includes('card')) {
             await captureOutlier(page, el, viewName, selector, 'borderRadius', styles.borderRadius, 'max 6px', 'P3', uniqueId);
        }
      }
    }
  }
}

async function validateButton(styles, text, selector, index, view, vp, el, page, id) {
  const isDark = vp.toLowerCase().includes('technician');
  const tokens = isDark ? DESIGN_TOKENS.dark.colors : DESIGN_TOKENS.light.colors;
  
  const bg = styles.backgroundColor;
  const height = parseInt(styles.height);
  const isMobile = vp.toLowerCase().includes('ipad');

  // Check Height
  const minHeight = isMobile ? DESIGN_TOKENS.minTouchSize : DESIGN_TOKENS.minDesktopSize;
  if (height < minHeight - 2) { // Allow slight subpixel diff
    await captureOutlier(page, el, view, `button[${text}]`, 'height', `${height}px`, `>=${minHeight}px`, 'P1', id);
  }

  // Check Colors (Very basic normalization)
  // Allowed: Primary, Transparent, Surface, White, Success/Danger/Warning
  const allowedBgs = [
    'rgba(0, 0, 0, 0)', 'transparent',
    'rgb(30, 109, 183)', // Primary Light
    'rgb(59, 158, 218)', // Primary Dark
    'rgb(255, 255, 255)', 
    'rgb(30, 41, 59)', // Surface Dark
    'rgb(239, 68, 68)', // Danger
    'rgb(16, 185, 129)', // Success
  ];

  const isAllowed = allowedBgs.some(a => bg.replace(/\s/g, '') === a.replace(/\s/g, ''));
  if (!isAllowed && bg !== 'rgba(0, 0, 0, 0)') {
     await captureOutlier(page, el, view, `button[${text}]`, 'backgroundColor', bg, 'System Theme Color', 'P2', id);
  }
}

async function captureOutlier(page, el, view, selector, prop, actual, expected, priority, id) {
  const screenshotName = `design-${view}-${id}-${prop}.png`;
  const screenshotPath = path.join(SCREENSHOT_DIR, screenshotName);
  
  if (!fs.existsSync(screenshotPath)) {
    try {
        await el.screenshot({ path: screenshotPath });
    } catch (e) {
        // Fallback to page screenshot if element is tricky
        await page.screenshot({ path: screenshotPath });
    }
  }

  outliers.push({
    page: view,
    element: selector,
    selector: `${selector}:nth-child(...)`,
    property: prop,
    actual,
    expected,
    screenshot: screenshotName,
    priority
  });
}

function generateReport() {
  let report = `# QTool Design Audit Report\n\n`;
  report += `**Generated:** ${new Date().toLocaleString()}\n\n`;
  report += `## Summary\n`;
  report += `- Total Elements Scanned: ${outliers.length * 5} (estimated)\n`;
  report += `- Outliers Found: ${outliers.length}\n\n`;

  report += `## Findings\n\n`;
  report += `| Priority | Page | Element | Property | Actual | Expected | Screenshot |\n`;
  report += `|----------|------|---------|----------|--------|----------|------------|\n`;

  for (const o of outliers) {
    report += `| ${o.priority} | ${o.page} | ${o.element} | ${o.property} | \`${o.actual}\` | \`${o.expected}\` | [View](./screenshots/${o.screenshot}) |\n`;
  }

  fs.writeFileSync(path.join(REPORT_DIR, 'qtool-design-audit.md'), report);
}
