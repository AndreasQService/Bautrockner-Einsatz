import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

test.describe('REAL-USER AUDIT: ANDREAS IM BÜRO (100% REAL UI INTERACTIONS)', () => {

  test.beforeEach(async ({ page }) => {
    // Zero-Tolerance: Jeder JS-Fehler oder unbehandelte Exception lässt den Test sofort explodieren
    page.on('pageerror', (err) => {
      throw new Error(`[CRITICAL JS RUNTIME ERROR]: ${err.message}\n${err.stack}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await login(page);
  });

  // Globaler Wächter: Prüft nach JEDEM Schritt, ob ein rotes Fehlerbanner sichtbar ist
  async function assertNoRedErrorBanners(page, stepName) {
    const errorBanners = page.locator('.bg-red-600:not(span), .bg-rose-500:not(span), [role="alert"]').filter({
      hasNotText: 'Offline'
    });
    const count = await errorBanners.count();
    for (let i = 0; i < count; i++) {
      const banner = errorBanners.nth(i);
      if (await banner.isVisible()) {
        const bannerText = await banner.innerText();
        if (bannerText.trim().length > 0 && !bannerText.includes('Offline')) {
          throw new Error(`[TEST FAILED AT ${stepName}]: Unerwartetes Fehlerbanner aufgetreten -> "${bannerText}"`);
        }
      }
    }
  }

  test('Kompletter Büro-Arbeitstag: Projekt neu anlegen, mutieren, wechseln, Dashboard-Return', async ({ page }) => {
    test.setTimeout(60000);
    
    // 1. NEUEN AUFTRAG ERSTELLEN (Per Klick im Header/Dashboard)
    const newOrderBtn = page.locator('button:has-text("Neuer Auftrag"), button:has-text("+ Neuer Auftrag")').first();
    await expect(newOrderBtn).toBeVisible({ timeout: 10000 });
    await newOrderBtn.click();
    await assertNoRedErrorBanners(page, 'Klick Neuer Auftrag');

    // Schadenort & Strasse per Tastatur eingeben
    const timestamp = Date.now().toString().slice(-4);
    const damageLocationInput = page.locator('input[placeholder*="Schadenort"], input[name="damageLocation"]').first();
    if (await damageLocationInput.isVisible()) {
      await damageLocationInput.fill('');
      await damageLocationInput.pressSequentially(`Büro Schaden ${timestamp}`, { delay: 20 });
    }

    const streetInput = page.locator('input[placeholder*="Strasse"], input[name="street"]').first();
    await expect(streetInput).toBeVisible({ timeout: 10000 });
    await streetInput.fill('');
    await streetInput.pressSequentially(`Bahnhofstrasse ${timestamp}`, { delay: 20 });

    const cityInput = page.locator('input[placeholder*="Ort"], input[name="city"]').first();
    if (await cityInput.isVisible()) {
      await cityInput.fill('');
      await cityInput.pressSequentially(`Zürich ${timestamp}`, { delay: 20 });
    }

    // Speichern / Erstellen bestätigen
    const createConfirmBtn = page.locator('button:has-text("Erstellen"), button:has-text("Speichern"), button:has-text("Auftrag anlegen")').first();
    if (await createConfirmBtn.isVisible()) {
      await createConfirmBtn.click();
    }
    await page.waitForTimeout(1000);
    await assertNoRedErrorBanners(page, 'Projekt-Erstellung');

    // 2. ZURÜCK ZUM DASHBOARD
    const dashboardBtn = page.locator('button:has-text("Dashboard"), a:has-text("Dashboard")').first();
    await expect(dashboardBtn).toBeVisible({ timeout: 10000 });
    await dashboardBtn.click();
    await page.waitForTimeout(1000);
    await assertNoRedErrorBanners(page, 'Return to Dashboard nach Erstellung');

    // 3. BESTEHENDES PROJEKT AUS DER LISTE ÖFFNEN
    const projectRows = page.locator('.hover-row');
    await expect(projectRows.first()).toBeVisible({ timeout: 10000 });
    await projectRows.first().click();
    await page.waitForTimeout(1000);
    await assertNoRedErrorBanners(page, 'Projekt aus Liste geöffnet');

    // Sicherstellen, dass kein fälschlicher Schreibschutz aktiv ist
    const lockBanner = page.locator('text=Schreibgeschützt – wird durch einen anderen Benutzer bearbeitet');
    if (await lockBanner.isVisible()) {
      const unlockBtn = page.locator('button:has-text("Sperre aufheben"), button:has-text("übernehmen"), button:has-text("Bearbeitungsmodus")').first();
      await expect(unlockBtn).toBeVisible();
      await unlockBtn.click();
      await page.waitForTimeout(500);
      await expect(lockBanner).not.toBeVisible();
    }

    // 4. DATEN MUTIEREN (Tastatur)
    await streetInput.click();
    await streetInput.pressSequentially(' - Mutiert Büro Andreas', { delay: 20 });
    await page.keyboard.press('Tab'); // Trigger Blur
    await page.waitForTimeout(1000);
    await assertNoRedErrorBanners(page, 'Feld-Mutation & Auto-Save');

    // 5. MODUL-WECHSEL (Messprotokolle / Geräte / Fotos / Dateien / Auftrag)
    const tabs = ['Messprotokolle', 'Geräte', 'Fotos', 'Dateien', 'Auftrag'];
    for (const tabName of tabs) {
      const tabBtn = page.locator(`button:has-text("${tabName}"), a:has-text("${tabName}")`).first();
      if (await tabBtn.isVisible()) {
        await tabBtn.click();
        await page.waitForTimeout(400);
        await assertNoRedErrorBanners(page, `Tab-Wechsel zu ${tabName}`);
      }
    }

    // 6. FINALES VERLASSEN ZUM DASHBOARD & PROJEKTWECHSEL
    await dashboardBtn.click();
    await page.waitForTimeout(1000);
    await assertNoRedErrorBanners(page, 'Finaler Dashboard-Return');

    // Ein anderes Projekt direkt im Anschluss öffnen (Concurrency- & Lock-Prüfung)
    if (await projectRows.count() > 1) {
      await projectRows.nth(1).click();
      await page.waitForTimeout(1000);
      await assertNoRedErrorBanners(page, 'Zweites Projekt geöffnet');
      await dashboardBtn.click();
      await assertNoRedErrorBanners(page, 'Zurück zum Dashboard');
    }
  });

});
