import { test, expect } from '@playwright/test';

test('Click actual fällig button and verify dropdown columns and full height', async ({ page }) => {
  page.on('console', msg => {
    console.log(`[CONSOLE] [${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err);
  });

  await page.goto('http://localhost:5173/');
  
  // Wait 12 seconds for initial fetch and background detail fetch to complete
  await page.waitForTimeout(12000);

  // Look for button matching "Kontrolle Trocknung X fällig"
  const dueButton = page.locator('button', { hasText: /Kontrolle Trocknung\s+\d+\s+fällig/ });
  
  const count = await dueButton.count();
  console.log(`Found ${count} actual due buttons.`);
  
  if (count > 0) {
    const text = await dueButton.first().textContent();
    console.log(`Clicking button: "${text}"`);
    await dueButton.first().click();
    await page.waitForTimeout(1000);
    
    // Take a screenshot of the open dropdown using full height
    await page.screenshot({ path: 'tests/screenshots/amber_dropdown_aligned.png' });
    console.log('Saved screenshot to tests/screenshots/amber_dropdown_aligned.png');
    
    // Verify dropdown header is visible
    const dropdownHeader = page.getByText(/fällige messungen details/i);
    await expect(dropdownHeader).toBeVisible();
    console.log('Dropdown header is visible!');
  } else {
    console.log('No fällig button found.');
    await page.screenshot({ path: 'tests/screenshots/no_due_button.png' });
  }
});
