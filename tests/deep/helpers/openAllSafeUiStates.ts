import { Page } from '@playwright/test';

/**
 * Helper to safely open UI elements for audit without triggering destructive actions.
 */
export async function openAllSafeUiStates(page: Page) {
  // 1. Open Status Dropdowns (if visible)
  const statusButtons = page.locator('button:has-text("Status"), button:has-text("Status ▾")');
  const count = await statusButtons.count();
  for (let i = 0; i < Math.min(count, 3); i++) {
    await statusButtons.nth(i).click().catch(() => {});
  }

  // 2. Open Accordions / Expandable sections
  const expandables = page.locator('button:has(svg[class*="chevron"]), [style*="cursor: pointer"]:has-text("Ursache")');
  const expCount = await expandables.count();
  for (let i = 0; i < Math.min(expCount, 5); i++) {
    await expandables.nth(i).click().catch(() => {});
  }

  // 3. Hover over buttons to check hover states
  const buttons = page.locator('button, .btn');
  const btnCount = await buttons.count();
  if (btnCount > 0) {
    await buttons.first().hover().catch(() => {});
  }

  // 4. Focus a form input to check focus states
  const inputs = page.locator('input, textarea');
  if (await inputs.count() > 0) {
    await inputs.first().focus().catch(() => {});
  }
  
  // Wait a bit for animations
  await page.waitForTimeout(300);
}
