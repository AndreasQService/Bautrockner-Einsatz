import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

test.describe('VERBINDLICHER BASIS-WORKFLOW: ÖFFNEN, EDITIEREN, DASHBOARD-RETURN', () => {

  test.beforeEach(async ({ page }) => {
    // Fängt unbemerkte JavaScript-Abbrüche und Runtime-Exceptions strikt ab
    page.on('pageerror', (err) => {
      throw new Error(`[PAGE RUNTIME ERROR]: ${err.message}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await login(page);
  });

  test('Echter Büro-Mitarbeiter: Projekt öffnen, Text ändern, zurück zum Dashboard', async ({ page }) => {
    // 1. PROJEKT AUS DER LISTE PER MAUSKLICK ÖFFNEN (Sidebar / Projektliste)
    const projectRow = page.locator('.hover-row').first();
    await expect(projectRow).toBeVisible({ timeout: 10000 });
    await projectRow.click();

    // 2. PRÜFEN, DASS KEINE BLOCKIERENDE SPERRE VORLIEGT
    const lockBanner = page.locator('text=Schreibgeschützt – wird durch einen anderen Benutzer bearbeitet');
    // Falls ein verwaister Lock existiert, muss der Übernehmen-Button funktionieren
    if (await lockBanner.isVisible()) {
      const takeoverBtn = page.locator('button:has-text("Sperre aufheben"), button:has-text("übernehmen"), button:has-text("Bearbeitungsmodus")').first();
      await expect(takeoverBtn).toBeVisible();
      await takeoverBtn.click();
      await expect(lockBanner).not.toBeVisible({ timeout: 5000 });
    }

    // 3. ECHTE TASTATUREINGABE IN EIN FORMULARFELD
    const streetInput = page.locator('input[name="street"], input[placeholder*="Strasse"], input[aria-label*="Strasse"]').first();
    await expect(streetInput).toBeVisible({ timeout: 12000 });

    const newStreetValue = `Musterstrasse ${Date.now().toString().slice(-4)}`;
    await streetInput.click();
    await streetInput.fill('');
    await streetInput.pressSequentially(newStreetValue, { delay: 30 });
    await page.keyboard.press('Tab'); // Trigger Blur & Auto-Save

    // 4. ZURÜCK ZUM DASHBOARD (KEINE EXIT-BLOCKADE ERLAUBT)
    const dashboardBtn = page.locator('button:has-text("Dashboard"), a:has-text("Dashboard")').first();
    await expect(dashboardBtn).toBeVisible({ timeout: 10000 });
    await dashboardBtn.click();

    // Das Exit-Blockade-Banner darf unter keinen Umständen erscheinen
    const blockBanner = page.locator('text=Projekt bleibt geöffnet');
    await expect(blockBanner).not.toBeVisible();

    // 5. SICHERSTELLEN, DASS WIR WIEDER AUF DEM DASHBOARD SIND
    await expect(projectRow).toBeVisible({ timeout: 10000 });

    // 6. EIN ZWEITES PROJEKT GEGENPROBE-ÖFFNEN
    const allProjects = page.locator('.hover-row');
    if (await allProjects.count() > 1) {
      await allProjects.nth(1).click();
      await expect(streetInput).toBeVisible({ timeout: 10000 });
      await dashboardBtn.click();
      await expect(blockBanner).not.toBeVisible();
      await expect(projectRow).toBeVisible({ timeout: 10000 });
    }
  });

});
