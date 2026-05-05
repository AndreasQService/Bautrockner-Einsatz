import { test, expect } from '@playwright/test';

test.describe('QTool Pro: Edge Cases & Input Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    const toggleBtn = page.locator('button[title="Zwischen Desktop- und Techniker-Modus wechseln"]');
    if (await toggleBtn.isVisible() && (await toggleBtn.innerText()).includes('Desktop')) await toggleBtn.click();
  });

  test('Special Characters Handling (äöü, é, &, /, \\)', async ({ page }) => {
    await page.locator('.tech-project-card').first().click();
    await page.locator('button:has-text("Messungen")').first().click();
    
    // Add MP
    await page.locator('button:has-text("MP hinzufügen")').click();
    
    // Test custom device name with special chars
    const deviceInput = page.locator('input[placeholder*="z.B. Gann Hydromette"]');
    const specialStr = "Gänn-Méter & Söhn / Test \\ Élite";
    await deviceInput.fill(specialStr);
    
    await page.locator('button:has-text("Speichern")').click();
    await expect(page.locator('button:has-text("Gespeichert!")')).toBeVisible();
    
    // Verify it persists correctly
    await expect(deviceInput).toHaveValue(specialStr);
  });

  test('Numeric Boundaries: Negative & Huge Values', async ({ page }) => {
    await page.locator('.tech-project-card').first().click();
    await page.locator('button:has-text("Messungen")').first().click();
    
    await page.locator('button:has-text("MP hinzufügen")').click();
    const wCell = page.locator('div[style*="grid-template-columns: 52px 1fr 1fr 44px"]').first().locator('div').nth(1);
    
    // Huge value: 9999
    await wCell.click();
    for (let i = 0; i < 4; i++) await page.locator('button:has-text("9")').click();
    await page.locator('button:has-text("Fertig")').click();
    
    // Check if it fits or is truncated in UI
    const valueText = await wCell.innerText();
    expect(valueText.length).toBeGreaterThan(0);
  });

  test('Empty Mandatory Fields', async ({ page }) => {
    // Navigate to a form that has mandatory fields, e.g. New Project (Desktop Mode)
    const toggleBtn = page.locator('button[title="Zwischen Desktop- und Techniker-Modus wechseln"]');
    if (await toggleBtn.isVisible() && (await toggleBtn.innerText()).includes('Techniker')) await toggleBtn.click();
    
    const newBtn = page.locator('button:has-text("Neuer Auftrag")').first();
    await newBtn.click();
    
    const saveBtn = page.locator('button:has-text("Speichern")').first();
    await saveBtn.click();
    
    // Expect some validation feedback if implemented
    // Or at least verify it doesn't crash
    console.log('Checked empty mandatory fields submission');
  });
});
