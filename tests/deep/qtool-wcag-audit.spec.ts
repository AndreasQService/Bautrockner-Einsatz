import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';

const REPORT_PATH = 'reports/deep/qtool-wcag-report.md';

test.describe('QTool Deep WCAG Audit', () => {
  let allViolations: any[] = [];

  test.afterAll(async () => {
    let report = '# QTool WCAG Audit Report\n\n';
    report += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    report += '| Impact | Page | Rule | Description | Help | Elements |\n';
    report += '|--------|------|------|-------------|------|----------|\n';
    
    for (const v of allViolations) {
      report += `| ${v.impact} | ${v.page} | ${v.id} | ${v.description} | [Help](${v.helpUrl}) | ${v.nodes.length} nodes |\n`;
    }
    
    fs.writeFileSync(REPORT_PATH, report);
  });

  const modes = [
    { name: 'Desktop-Light', theme: 'light', width: 1920, height: 1080 },
    { name: 'Desktop-Dark', theme: 'dark', width: 1920, height: 1080 },
    { name: 'iPad-Technician', theme: 'dark', width: 834, height: 1194, isMobile: true },
  ];

  for (const mode of modes) {
    test(`WCAG Audit for ${mode.name}`, async ({ page }) => {
      await page.setViewportSize({ width: mode.width, height: mode.height });
      await page.goto('http://localhost:5173');
      
      // Set theme
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), mode.theme);
      await page.waitForTimeout(500);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      allViolations.push(...accessibilityScanResults.violations.map(v => ({
        ...v,
        page: mode.name
      })));

      // We don't fail the test here to collect all results, but the report will show them.
    });
  }
});
