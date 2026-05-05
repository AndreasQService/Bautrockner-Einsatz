import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

// Viewports to test
const viewports = [
    { name: 'Desktop', width: 1920, height: 1080, type: 'desktop' },
    { name: 'Laptop', width: 1366, height: 768, type: 'desktop' },
    { name: 'iPad', width: 1024, height: 1366, type: 'tablet' },
    { name: 'iPhone', width: 390, height: 844, type: 'mobile' }
];

// Results storage
const auditResults = {
    summary: {
        timestamp: new Date().toISOString(),
        totalViolations: 0,
        bySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0 }
    },
    sections: []
};

const REPORT_DIR = path.join(process.cwd(), 'reports', 'accessibility');
const SCREENSHOT_DIR = path.join(REPORT_DIR, 'screenshots');

// Ensure directories exist
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function runAxe(page, sectionName, viewportName) {
    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

    const resultEntry = {
        section: sectionName,
        viewport: viewportName,
        violations: results.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            help: v.help,
            helpUrl: v.helpUrl,
            nodes: v.nodes.map(n => ({
                target: n.target,
                html: n.html,
                failureSummary: n.failureSummary
            }))
        }))
    };

    auditResults.sections.push(resultEntry);

    // Update summary
    for (const v of results.violations) {
        auditResults.summary.totalViolations++;
        auditResults.summary.bySeverity[v.impact || 'minor']++;
    }

    // Capture screenshot if critical or serious violations found
    const hasSerious = results.violations.some(v => v.impact === 'critical' || v.impact === 'serious');
    if (hasSerious) {
        const screenshotPath = path.join(SCREENSHOT_DIR, `${sectionName}-${viewportName}-violations.png`.toLowerCase().replace(/\s+/g, '-'));
        await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    return results.violations;
}

async function checkReadability(page, sectionName, viewport) {
    // Custom checks for readability
    const readabilityIssues = [];

    // Check font sizes
    const textElements = await page.evaluate((v) => {
        const elements = Array.from(document.querySelectorAll('p, span, div, td, li, label, h1, h2, h3, h4, h5, h6'));
        return elements.map(el => {
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            const lineHeight = parseFloat(style.lineHeight) / fontSize;
            const opacity = parseFloat(style.opacity);
            const text = el.innerText.trim();
            const rect = el.getBoundingClientRect();
            
            return {
                tag: el.tagName,
                fontSize,
                lineHeight,
                opacity,
                text: text.substring(0, 50),
                width: rect.width,
                height: rect.height,
                isVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
            };
        }).filter(item => item.isVisible && item.text.length > 0);
    }, viewport);

    for (const el of textElements) {
        // Desktop font size check (min 14px)
        if (viewport.type === 'desktop' && el.fontSize < 14 && el.text.length > 5) {
            readabilityIssues.push({ type: 'FontSizeTooSmall', detail: `Font size ${el.fontSize}px is below 14px for desktop`, text: el.text });
        }
        // Tablet/Mobile font size check (min 16px)
        if (viewport.type !== 'desktop' && el.fontSize < 16 && el.text.length > 5) {
            readabilityIssues.push({ type: 'FontSizeTooSmall', detail: `Font size ${el.fontSize}px is below 16px for touch device`, text: el.text });
        }
        // Line height check (min 1.3)
        if (el.lineHeight < 1.3 && el.text.length > 20) {
            readabilityIssues.push({ type: 'LineHeightTooSmall', detail: `Line height ratio ${el.lineHeight.toFixed(2)} is below 1.3`, text: el.text });
        }
        // Opacity check (min 0.65)
        if (el.opacity < 0.65) {
            readabilityIssues.push({ type: 'LowOpacity', detail: `Opacity ${el.opacity} is below 0.65`, text: el.text });
        }
    }

    // Touch target check
    if (viewport.type !== 'desktop') {
        const touchTargets = await page.evaluate(() => {
            const targets = Array.from(document.querySelectorAll('button, a, input, select, [role="button"]'));
            return targets.map(el => {
                const rect = el.getBoundingClientRect();
                return {
                    tag: el.tagName,
                    width: rect.width,
                    height: rect.height,
                    text: el.innerText.trim().substring(0, 30) || el.getAttribute('aria-label') || el.name || 'unlabeled'
                };
            });
        });

        for (const target of touchTargets) {
            if (target.width < 44 || target.height < 44) {
                // Checkboxes allowed smaller but user wants 24x24 or 32x32
                if (target.tag === 'INPUT' && (target.width < 24 || target.height < 24)) {
                    readabilityIssues.push({ type: 'TouchTargetTooSmall', detail: `Checkbox ${target.width}x${target.height} is below 24x24`, text: target.text });
                } else if (target.tag !== 'INPUT' && (target.width < 44 || target.height < 44)) {
                    readabilityIssues.push({ type: 'TouchTargetTooSmall', detail: `Touch target ${target.width.toFixed(1)}x${target.height.toFixed(1)} is below 44x44`, text: target.text });
                }
            }
        }
    }

    if (readabilityIssues.length > 0) {
        auditResults.sections.push({
            section: `${sectionName} (Readability)`,
            viewport: viewport.name,
            issues: readabilityIssues
        });
    }
}

test.describe('QTool Deep WCAG Audit', () => {
    
    for (const viewport of viewports) {
        test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
            
            test.beforeEach(async ({ page }) => {
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                await page.goto('/');
                
                // Force Light Mode if not already set
                await page.evaluate(() => {
                    document.documentElement.setAttribute('data-theme', 'light');
                    localStorage.setItem('qtool_dark_mode', 'false');
                });
                await page.reload(); // Reload to ensure light mode is applied
            });

            test('1. Dashboard Audit', async ({ page }) => {
                await expect(page.locator('body')).toBeVisible();
                // Wait for dashboard content
                await page.waitForSelector('.card', { timeout: 10000 }).catch(() => {});
                
                await runAxe(page, 'Dashboard', viewport.name);
                await checkReadability(page, 'Dashboard', viewport);
                
                // Fullpage screenshot
                await page.screenshot({ path: path.join(SCREENSHOT_DIR, `fullpage-dashboard-${viewport.name}.png`.toLowerCase()), fullPage: true });
            });

            test('2. Workflow Overview Audit', async ({ page }) => {
                // Navigate to Workflow (assuming it's a tab or link)
                const workflowLink = page.locator('text=Workflow').first();
                if (await workflowLink.isVisible()) {
                    await workflowLink.click();
                    await page.waitForTimeout(1000);
                    
                    await runAxe(page, 'Workflow', viewport.name);
                    await checkReadability(page, 'Workflow', viewport);
                    
                    // Fullpage screenshot
                    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `fullpage-workflow-${viewport.name}.png`.toLowerCase()), fullPage: true });
                }
            });

            test('3. Project Details & Damage Form Audit', async ({ page }) => {
                // Open first project from dashboard
                const firstProject = page.locator('.card, tr').first();
                if (await firstProject.isVisible()) {
                    await firstProject.click();
                    await page.waitForSelector('text=Schadenaufnahme', { timeout: 10000 }).catch(() => {});

                    const sections = [
                        'Auftragdetails',
                        'Schadenaufnahme',
                        'Leckortung',
                        'Bericht',
                        'Trocknung',
                        'Instandstellung',
                        'Rechnung',
                        'Abschluss'
                    ];

                    for (const section of sections) {
                        const tab = page.locator(`text=${section}`).first();
                        if (await tab.isVisible()) {
                            await tab.click();
                            await page.waitForTimeout(500);
                            await runAxe(page, section, viewport.name);
                            await checkReadability(page, section, viewport);
                        }
                    }
                    
                    // Deep dive into Measurements
                    const measurementTab = page.locator('text=Messungen').first();
                    if (await measurementTab.isVisible()) {
                        await measurementTab.click();
                        await page.waitForTimeout(1000);
                        await runAxe(page, 'Messungen', viewport.name);
                        await checkReadability(page, 'Messungen', viewport);
                        
                        // Fullpage screenshot for measurements
                        if (viewport.name.includes('iPad')) {
                            await page.screenshot({ path: path.join(SCREENSHOT_DIR, `fullpage-measurements-ipad.png`), fullPage: true });
                        }
                    }
                }
            });

            test('4. Technician Mode Audit', async ({ page }) => {
                // Switch to Technician Mode
                const techToggle = page.locator('button:has-text("Techniker"), [title*="Techniker"]').first();
                if (await techToggle.isVisible()) {
                    await techToggle.click();
                    await page.waitForTimeout(1000);
                    
                    await runAxe(page, 'TechnicianMode', viewport.name);
                    await checkReadability(page, 'TechnicianMode', viewport);
                    
                    if (viewport.name.includes('iPad')) {
                        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `fullpage-technician-ipad.png`), fullPage: true });
                    }
                }
            });
        });
    }

    test.afterAll(async () => {
        // Generate the final Markdown report
        let report = `# QTool WCAG & UX Audit Report\n\n`;
        report += `**Timestamp:** ${auditResults.summary.timestamp}\n\n`;
        
        report += `## Summary\n`;
        report += `| Severity | Count |\n`;
        report += `| --- | --- |\n`;
        report += `| Critical | ${auditResults.summary.bySeverity.critical} |\n`;
        report += `| Serious | ${auditResults.summary.bySeverity.serious} |\n`;
        report += `| Moderate | ${auditResults.summary.bySeverity.moderate} |\n`;
        report += `| Minor | ${auditResults.summary.bySeverity.minor} |\n\n`;
        
        report += `Total Violations: ${auditResults.summary.totalViolations}\n\n`;
        
        report += `## Detailed Findings\n\n`;
        
        for (const section of auditResults.sections) {
            report += `### ${section.section} (${section.viewport})\n`;
            
            if (section.violations && section.violations.length > 0) {
                report += `#### Accessibility Violations\n`;
                for (const v of section.violations) {
                    report += `- **${v.impact.toUpperCase()}:** ${v.help} (${v.id})\n`;
                    report += `  - *Description:* ${v.description}\n`;
                    report += `  - *Affected Elements:* ${v.nodes.length} nodes\n`;
                }
            }
            
            if (section.issues && section.issues.length > 0) {
                report += `#### Readability & UX Issues\n`;
                for (const issue of section.issues) {
                    report += `- **${issue.type}:** ${issue.detail}\n`;
                    report += `  - *Snippet:* "${issue.text}"\n`;
                }
            }
            
            report += `\n---\n\n`;
        }
        
        fs.writeFileSync(path.join(REPORT_DIR, 'qtool-wcag-report.md'), report);
        console.log(`Audit complete. Report generated at: ${path.join(REPORT_DIR, 'qtool-wcag-report.md')}`);
    });
});
