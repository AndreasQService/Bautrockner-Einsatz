import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

/**
 * Tests für das Dashboard
 */
test.describe('Dashboard', () => {

    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Dashboard wird nach Login angezeigt', async ({ page }) => {
        await expect(page.locator('header.app-header')).toBeVisible();
        await expect(page.getByRole('button', { name: /neuer auftrag/i })).toBeVisible();
    });

    test('Navigation: Dashboard zeigt Hauptbereiche', async ({ page }) => {
        await expect(page.locator('main.container')).toBeVisible();
    });

    test('Admin-Toolbar: Geräteverwaltungs-Button vorhanden', async ({ page }) => {
        await expect(page.locator('button[title="Geräteverwaltung"]')).toBeVisible();
    });

    test('Admin-Toolbar: Benutzer-Button vorhanden', async ({ page }) => {
        await expect(page.locator('button[title="Benutzer"]')).toBeVisible();
    });

    test('Admin-Toolbar: Messgeräte-Button vorhanden', async ({ page }) => {
        await expect(page.locator('button[title="Messgeräte"]')).toBeVisible();
    });

    test('Desktop/Techniker-Modus umschalten', async ({ page }) => {
        // Das User-Info-Div (position:absolute) überlagert den Button.
        // evaluate(btn.click()) triggert den React-Eventhandler zuverlässig.

        const desktopBtn = page.locator('button', { hasText: 'Desktop' });
        await desktopBtn.waitFor({ state: 'visible', timeout: 3000 });

        // JavaScript-Click → React-State ändert sich (isTechnicianMode = true)
        await desktopBtn.evaluate(btn => btn.click());

        // Nach dem Toggle: Text wechselt zu "Techniker"
        await expect(page.locator('button', { hasText: 'Techniker' })).toBeVisible({ timeout: 3000 });

        // Zurück zu Desktop
        await page.locator('button', { hasText: 'Techniker' }).evaluate(btn => btn.click());
        await expect(page.locator('button', { hasText: 'Desktop' })).toBeVisible({ timeout: 3000 });
    });

    test('Import-Button öffnet Email-Import-Modal', async ({ page }) => {
        // Der Import-Button hat text "Import" in einem span
        await page.locator('button', { hasText: 'Import' }).click({ force: true });

        // Das Modal heißt "Projekt aus Email / PDF importieren"
        await expect(page.getByText(/projekt aus email/i)).toBeVisible({ timeout: 5000 });
    });

    test('Geräteverwaltung: Ansicht öffnen und schließen', async ({ page }) => {
        await page.locator('button[title="Geräteverwaltung"]').click();

        // In der Geräteverwaltung gibt es den "Dashboard"-Button
        const dashboardBtn = page.locator('button', { hasText: 'Dashboard' }).first();
        await expect(dashboardBtn).toBeVisible({ timeout: 5000 });
        await dashboardBtn.click();

        // Zurück im Dashboard
        await expect(page.getByRole('button', { name: /neuer auftrag/i })).toBeVisible();
    });

    test('Benutzerverwaltung-Modal öffnen', async ({ page }) => {
        await page.locator('button[title="Benutzer"]').click();

        // Das Modal hat die Überschrift "Benutzerverwaltung" (via createPortal in document.body)
        await expect(page.getByText('Benutzerverwaltung')).toBeVisible({ timeout: 3000 });
    });

});
