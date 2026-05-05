import { Page, Locator } from '@playwright/test';
import * as path from 'path';

const SCREENSHOT_DIR = 'reports/deep/screenshots';

/**
 * Capture a screenshot for the audit report.
 */
export async function captureAuditScreenshot(page: Page | Locator, name: string) {
  const safeName = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const filePath = path.join(SCREENSHOT_DIR, `${safeName}.png`);
  
  await page.screenshot({ path: filePath });
  return filePath;
}
