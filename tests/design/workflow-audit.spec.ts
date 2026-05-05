import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * QTool Workflow Design Audit
 * Checks font sizes, contrast, layout, and hit areas for the Workflow Overview.
 */

const VIEWPORTS = [
  { name: 'Desktop-1366x768', width: 1366, height: 768, mode: 'light', isMobile: false },
  { name: 'Desktop-1440x900', width: 1440, height: 900, mode: 'light', isMobile: false },
  { name: 'Desktop-1920x1080', width: 1920, height: 1080, mode: 'light', isMobile: false },
  { name: 'Desktop-Dark', width: 1440, height: 900, mode: 'dark', isMobile: false },
  { name: 'iPad-Landscape', width: 1194, height: 834, mode: 'light', isMobile: true },
  { name: 'iPad-Portrait', width: 834, height: 1194, mode: 'light', isMobile: true },
];

const REPORT_DIR = 'test-results/design-review';
const REPORT_FILE = 'design-audit-report.md';

// Ensure directories exist
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

interface DesignIssue {
  page: string;
  selector: string;
  text: string;
  type: string;
  actualFs?: string;
  actualContrast?: string;
  boundingBox?: string;
  screenshot?: string;
  recommendation: string;
}

const issues: DesignIssue[] = [];

test.describe('Workflow Design Audit', () => {
  // Increase timeout for the whole suite
  test.slow();

  test('Perform Comprehensive Design Audit', async ({ page }) => {
    // 1. Run through each viewport
    for (const vp of VIEWPORTS) {
      console.log(`Auditing Viewport: ${vp.name}`);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      
      // Navigate to Dashboard
      try {
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 60000 });
      } catch (e) {
        console.warn(`Initial goto failed or timed out for ${vp.name}, retrying...`);
        await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 30000 });
      }
      
      // Set Theme
      await page.evaluate((mode) => {
        document.documentElement.setAttribute('data-theme', mode === 'dark' ? 'dark' : 'light');
        // Force "Alle Mitarbeiter" filter to see projects
        const select = document.querySelector('select');
        if (select) {
            select.value = 'alle';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, vp.mode);
      await page.waitForTimeout(1000);

      // Ensure Workflow section is visible
      const workflowHeader = page.locator('h2:has-text("Workflow-Übersicht")');
      await expect(workflowHeader).toBeVisible({ timeout: 15000 });
      await workflowHeader.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);

      // Take Screenshot
      const screenshotName = `workflow-${vp.name}.png`;
      const screenshotPath = path.join(REPORT_DIR, screenshotName);
      await page.screenshot({ path: screenshotPath });

      // Perform deep analysis on the primary Desktop Light viewport
      if (vp.name === 'Desktop-1440x900') {
        await performDeepAudit(page, vp.name);
      }
    }

    // 2. Generate Report
    generateMarkdownReport();
  });
});

async function performDeepAudit(page, vpName: string) {
  const auditResults = await page.evaluate(() => {
    // --- Helper Functions ---
    function getRecursiveBackgroundColor(el) {
      let currentEl = el;
      while (currentEl) {
        const bg = window.getComputedStyle(currentEl).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          return bg;
        }
        currentEl = currentEl.parentElement;
      }
      return 'rgb(255, 255, 255)'; // Fallback to white
    }

    function luminance(r, g, b) {
      const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    }

    function parseRGB(color) {
      const m = color.match(/\d+/g);
      if (!m) return [0, 0, 0];
      return [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])];
    }

    function calculateContrast(fg, bg) {
      const L1 = luminance(...parseRGB(fg));
      const L2 = luminance(...parseRGB(bg));
      const lighter = Math.max(L1, L2);
      const darker = Math.min(L1, L2);
      return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
    }

    function isElementInViewport(el) {
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    }

    const results: any[] = [];
    
    // --- Audit Logic ---
    const h2s = Array.from(document.querySelectorAll('h2'));
    const workflowTitleEl = h2s.find(h => h.textContent.includes('Workflow-Übersicht'));
    const container = workflowTitleEl?.closest('div')?.parentElement; // Go one level higher to catch the card
    if (!container) return results;

    const elementsToAudit = Array.from(container.querySelectorAll('*')).filter(el => {
        // We want to check:
        // 1. Leaf elements with text
        // 2. Elements with text directly in them (even if they have children)
        // 3. Interactive elements
        const hasDirectText = Array.from(el.childNodes).some(node => node.nodeType === 3 && node.textContent.trim().length > 0);
        const isInteractive = el.tagName === 'BUTTON' || el.tagName === 'SELECT' || el.tagName === 'A' || window.getComputedStyle(el).cursor === 'pointer';
        const isHeader = el.tagName === 'TH' || el.tagName === 'H2' || el.tagName === 'H3';
        
        return hasDirectText || isInteractive || isHeader;
    });

    elementsToAudit.forEach(el => {
      const style = window.getComputedStyle(el);
      const fs = parseFloat(style.fontSize);
      const fg = style.color;
      const bg = getRecursiveBackgroundColor(el);
      const contrast = calculateContrast(fg, bg);
      const text = el.textContent?.trim().substring(0, 30) || '';
      const rect = el.getBoundingClientRect();
      
      const isClickable = el.tagName === 'BUTTON' || style.cursor === 'pointer';
      const width = rect.width;
      const height = rect.height;

      // Rule 1: Font Size
      let fsIssue = null;
      if (fs < 13) {
        fsIssue = `CRITICAL: Font size ${fs}px < 13px`;
      } else if (fs < 14) {
        fsIssue = `WARNING: Font size ${fs}px < 14px`;
      }

      // Rule 2: Contrast
      let contrastIssue = null;
      const cVal = parseFloat(contrast);
      if (cVal < 3.0) {
        contrastIssue = `CRITICAL: Contrast ratio ${contrast}:1 < 3:1`;
      } else if (cVal < 4.5) {
        contrastIssue = `WARNING: Contrast ratio ${contrast}:1 < 4.5:1`;
      } else if (cVal < 7.0 && (text.includes('!') || el.tagName === 'BUTTON' || el.classList.contains('status-badge'))) {
        contrastIssue = `WARNING: Status/Action contrast ${contrast}:1 < 7:1`;
      }

      // Rule 4: Layout / Bounding Box
      let layoutIssue = null;
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        // Partial visibility is common, but let's check if it's clipped by parent
        const parent = el.parentElement;
        if (parent) {
            const pRect = parent.getBoundingClientRect();
            if (rect.left < pRect.left - 1 || rect.right > pRect.right + 1) {
                layoutIssue = 'WARNING: Element horizontally clipped by parent';
            }
        }
      }

      // Rule 5: Touch targets
      let touchIssue = null;
      if (isClickable) {
        if (width < 32 || height < 32) {
            touchIssue = `CRITICAL: Hit area ${Math.round(width)}x${Math.round(height)}px too small`;
        }
      }

      if (fsIssue || contrastIssue || layoutIssue || touchIssue) {
        results.push({
          selector: el.tagName.toLowerCase() + (el.className ? '.' + Array.from(el.classList).join('.') : ''),
          text,
          type: [fsIssue, contrastIssue, layoutIssue, touchIssue].filter(Boolean).join('; '),
          actualFs: fs + 'px',
          actualContrast: contrast + ':1',
          boundingBox: `${Math.round(width)}x${Math.round(height)}`,
        });
      }
    });

    return results;
  });

  // Add results to global issues list
  auditResults.forEach(res => {
    let rec = "";
    if (res.type.includes("Font size")) rec += "Increase font-size (min 14px for labels). ";
    if (res.type.includes("Contrast")) rec += "Improve contrast (min 4.5:1 for normal, 7:1 for status). ";
    if (res.type.includes("Hit area")) rec += "Increase hit area to 32px/44px. ";
    if (res.type.includes("clipped")) rec += "Fix layout/overflow. ";
    
    issues.push({
      page: 'Dashboard / Workflow-Übersicht',
      selector: res.selector,
      text: res.text,
      type: res.type,
      actualFs: res.actualFs,
      actualContrast: res.actualContrast,
      boundingBox: res.boundingBox,
      screenshot: `workflow-${vpName}.png`,
      recommendation: rec || "Review design."
    });
  });
}

function generateMarkdownReport() {
  let report = `# QTool Design Audit Report: Workflow-Übersicht\n\n`;
  report += `**Generated:** ${new Date().toLocaleString()}\n`;
  report += `**Scope:** Workflow-Übersicht / Projektübersicht\n\n`;

  report += `## Summary of Findings\n`;
  report += `- **Total Issues Found:** ${issues.length}\n`;
  report += `- **Critical Failures:** ${issues.filter(i => i.type.includes('CRITICAL')).length}\n`;
  report += `- **Warnings:** ${issues.filter(i => i.type.includes('WARNING')).length}\n\n`;

  report += `## Visual Evidence (Screenshots)\n`;
  for (const vp of VIEWPORTS) {
    report += `### ${vp.name}\n`;
    report += `![${vp.name}](./${'workflow-' + vp.name + '.png'})\n\n`;
  }

  report += `## Detailed Findings\n\n`;
  report += `| Priority | Element | Text | Size | Contrast | Box | Recommendation |\n`;
  report += `|----------|---------|------|------|----------|-----|----------------|\n`;

  // Deduplicate and sort by priority
  const uniqueIssues = new Map();
  for (const issue of issues) {
    const key = `${issue.selector}-${issue.type}`;
    if (!uniqueIssues.has(key)) {
      uniqueIssues.set(key, issue);
    }
  }

  const sortedIssues = Array.from(uniqueIssues.values()).sort((a, b) => {
    if (a.type.includes('CRITICAL') && !b.type.includes('CRITICAL')) return -1;
    if (!a.type.includes('CRITICAL') && b.type.includes('CRITICAL')) return 1;
    return 0;
  });

  for (const i of sortedIssues) {
    const priority = i.type.includes('CRITICAL') ? '🔴 CRITICAL' : '🟡 WARNING';
    report += `| ${priority} | \`${i.selector}\` | "${i.text}" | ${i.actualFs} | ${i.actualContrast} | ${i.boundingBox} | ${i.recommendation} |\n`;
  }

  fs.writeFileSync(path.join(REPORT_DIR, REPORT_FILE), report);
  console.log(`Report generated at ${path.join(REPORT_DIR, REPORT_FILE)}`);
}
