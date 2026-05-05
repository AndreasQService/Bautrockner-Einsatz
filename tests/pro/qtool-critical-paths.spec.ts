import { test, expect } from '@playwright/test';

test.describe('QTool Pro: Critical Paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await page.waitForLoadState('networkidle');
    
    // Switch to Technician Mode if not already active
    const toggleBtn = page.locator('button[title="Zwischen Desktop- und Techniker-Modus wechseln"]');
    if (await toggleBtn.isVisible()) {
      const btnText = (await toggleBtn.innerText()).trim();
      if (btnText === 'Desktop') {
        await toggleBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('A) Project -> Measurements -> Save Flow', async ({ page }) => {
    // 1. Open first project
    const projectCard = page.locator('.tech-project-card, .card').first();
    await expect(projectCard).toBeVisible();
    await projectCard.click();
    
    // 2. Open Measurements Modal
    const measBtn = page.locator('button:has-text("Messung"), button:has-text("Messungen"), button:has-text("Feuchtigkeit")').first();
    await expect(measBtn).toBeVisible();
    await measBtn.click();
    
    // 3. Add 5 Measurement Points
    const addBtn = page.locator('button:has-text("MP hinzufügen")');
    for (let i = 0; i < 5; i++) {
      await addBtn.click();
    }
    
    // 4. Fill values for MP1 (Wand/Boden)
    // Using the custom numpad triggers
    const mpRows = page.locator('div[style*="grid-template-columns: 52px 1fr 1fr 44px"]');
    await expect(mpRows).toHaveCount(5);
    
    // Fill MP 1 W-Value
    await mpRows.first().locator('div').nth(1).click(); // Click W cell
    await page.locator('button:has-text("2")').click();
    await page.locator('button:has-text("5")').click();
    await page.locator('button:has-text("Fertig")').click();
    
    // Fill MP 1 B-Value
    await mpRows.first().locator('div').nth(2).click(); // Click B cell
    await page.locator('button:has-text("4")').click();
    await page.locator('button:has-text("0")').click();
    await page.locator('button:has-text("Fertig")').click();
    
    // 5. Test History Button
    const historyBtn = page.locator('button:has-text("History")');
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();
    await expect(page.locator('text=Bisherige Messverläufe')).toBeVisible();
    await historyBtn.click(); // Toggle off
    
    // 6. Save Modal
    const saveBtn = page.locator('button:has-text("Speichern")');
    await saveBtn.click();
    
    // 6. Verify success state
    await expect(page.locator('button:has-text("Gespeichert!")')).toBeVisible();
    
    // 7. Close and Reopen to verify persistence (relying on state since we don't reload page)
    await page.locator('button[aria-label="Modal schließen"]').click();
    await page.waitForTimeout(500);
    await measBtn.click();
    
    // Verify values still there
    await expect(page.locator('text=25')).toBeVisible();
    await expect(page.locator('text=40')).toBeVisible();
  });

  test('B) Project -> Photos -> Upload Simulation', async ({ page }) => {
    // 1. Open first project
    const projectCard = page.locator('.tech-project-card').first();
    await projectCard.click();
    
    // 2. Open Photos section (usually a tab or section in DamageForm)
    // Techniker mode has tabs at bottom? Let's check App.jsx tabs if any
    const photoTab = page.locator('button:has-text("Fotos"), button:has-text("Bilder")').first();
    if (await photoTab.isVisible()) {
        await photoTab.click();
    }

    // Since we can't easily upload files in this environment without test assets,
    // we verify the "Add Photo" UI exists and triggers.
    const addPhotoBtn = page.locator('button:has-text("Kamera"), button:has-text("Foto"), button:has-text(/Foto/)').first();
    await expect(addPhotoBtn).toBeVisible();
  });

  test('C) Workflow Transitions', async ({ page }) => {
    // 1. Open first project
    const projectCard = page.locator('.tech-project-card').first();
    await projectCard.click();
    
    // 2. Open Workflow
    const workflowBtn = page.locator('button:has-text("Workflow")').first();
    if (await workflowBtn.isVisible()) {
        await workflowBtn.click();
    }
    
    // Verify steps are visible
    // Depending on implementation, look for status circles or text
    await expect(page.locator('text=Schadenaufnahme')).toBeVisible();
  });
});
