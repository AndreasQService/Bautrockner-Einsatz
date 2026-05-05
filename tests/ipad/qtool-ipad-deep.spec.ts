import { test, expect, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * QTool iPad Technician Mode Deep Audit
 * Focus: Touch targets, WCAG compliance, and layout responsiveness on iPad Pro 11.
 */

test.use({
  ...devices['iPad Pro 11'],
  viewport: { width: 834, height: 1194 }, // iPad Pro 11 portrait
  permissions: [],
});

test.describe('QTool iPad Technician Mode Audit', () => {

  test('comprehensive workflow audit in technician mode', async ({ page }) => {
    // 1. Navigate to the app
    await page.goto('http://localhost:5173');

    // 2. Login (assuming simple login screen exists)
    const loginButton = page.locator('button:has-text("Anmelden")');
    if (await loginButton.isVisible()) {
      await page.locator('select').selectOption({ index: 0 });
      await loginButton.click();
    }

    // 3. Toggle Technician Mode
    const modeToggle = page.locator('header button:has-text("Desktop"), header button:has-text("Techniker")');
    await expect(modeToggle).toBeVisible({ timeout: 15000 });
    
    const currentModeText = await modeToggle.innerText();
    if (currentModeText.includes('Desktop')) {
      await modeToggle.click();
      // Wait for the UI to transition
      await page.waitForTimeout(2000);
      
      // Explicitly click Dashboard to ensure we are on the project list
      const dashboardBtn = page.locator('button:has-text("Dashboard"), .lucide-layout-dashboard').first();
      if (await dashboardBtn.isVisible()) {
          await dashboardBtn.click();
      }
    }

    // 4. Wait for content
    await page.waitForSelector('.tech-project-card, .project-card, .damage-report-card, tr', { timeout: 15000 });

    // 5. Axe Audit: Dashboard (Technician Mode)
    const accessibilityScanResultsDashboard = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
      .analyze();
    
    console.log(`Dashboard (Tech) Accessibility Violations: ${accessibilityScanResultsDashboard.violations.length}`);
    if (accessibilityScanResultsDashboard.violations.length > 0) {
        accessibilityScanResultsDashboard.violations.forEach(v => console.log(`- ${v.id}: ${v.help}`));
    }

    // 6. Open a Project
    const projectLocator = page.locator('.tech-project-card, .project-card, .damage-report-card, tr').first();
    await projectLocator.click();

    // 6. Navigate to Measurements
    // In Tech Mode, click the 'Messung' tile
    const measurementTile = page.locator('button:has-text("Messung")').first();
    await expect(measurementTile).toBeVisible();
    await measurementTile.click();

    // 7. Handle Room/Apartment Selector (Wait for the overlay)
    // Wait for the 'Wohnung wählen' or similar header
    const selectorHeader = page.locator('h3:has-text("Wohnung wählen"), h3:has-text("Whg"), h3:has-text("Wählen")').first();
    await expect(selectorHeader).toBeVisible({ timeout: 10000 });

    // Select the first apartment
    const apartmentBtn = page.locator('button:has-text("➔")').first();
    await apartmentBtn.click();
    
    await page.waitForTimeout(1000); // Wait for room list

    // Select the first room
    const roomBtn = page.locator('button:has-text("➔")').first();
    await roomBtn.click();
    
    await page.waitForTimeout(1000); // Wait for modal animation

    // 8. Open Measurement Modal
    // Once a room is selected, the modal should open automatically
    // The modal uses .measurement-modal-overlay and .modal-container
    await expect(page.locator('.measurement-modal-overlay, .modal-container')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'artifacts/ipad/measurement-modal-full.png' });

    // 9. Axe Audit: Measurement Modal
    const accessibilityScanResultsModal = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
      .analyze();
    console.log(`Measurement Modal Accessibility Violations: ${accessibilityScanResultsModal.violations.length}`);

    // 10. Check Touch Targets in Modal
    // We'll check buttons for minimum 44px size
    const modalButtons = await page.locator('button').all();
    let smallTargets = 0;
    for (const btn of modalButtons) {
        if (await btn.isVisible()) {
            const box = await btn.boundingBox();
            if (box && (box.width < 44 || box.height < 44)) {
                const text = await btn.innerText();
                console.warn(`Small touch target: "${text}" (${Math.round(box.width)}x${Math.round(box.height)})`);
                smallTargets++;
            }
        }
    }
    console.log(`Total small touch targets found: ${smallTargets}`);

    // 11. Finalize
    // Look for the close button (often an X icon or 'Schliessen')
    const closeBtn = page.locator('button:has-text("Schliessen"), button .lucide-x, button:has-text("Speichern")').last();
    await closeBtn.click();
    
    console.log("Audit complete.");
  });
});
