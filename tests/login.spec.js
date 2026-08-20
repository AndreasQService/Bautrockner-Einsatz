import { test, expect } from '@playwright/test';

/**
 * Tests für den Login-Screen
 * Getestet werden: Anzeige, erfolgreicher Login, fehlerhafter Login, Logout
 */
test.describe('Login', () => {

    test.beforeEach(async ({ page }) => {
        // Vor jedem Test: localStorage leeren um garantiert den Login-Screen zu sehen
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.removeItem('qservice_current_view');
            localStorage.removeItem('qtool_users_v2');
        });
        await page.reload();

        // Falls noch eingeloggt → ausloggen
        const logoutBtn = page.locator('button[title="Abmelden"]');
        if (await logoutBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await logoutBtn.click();
        }
    });

    test('Login-Screen wird angezeigt wenn nicht eingeloggt', async ({ page }) => {
        await expect(page.locator('h2')).toContainText('Anmelden');
        await expect(page.locator('input[type="text"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.getByRole('button', { name: /anmelden/i })).toBeVisible();
    });

    test('Fehlermeldung bei leeren Feldern', async ({ page }) => {
        await page.getByRole('button', { name: /anmelden/i }).click();
        await expect(page.getByText(/bitte name und passwort/i)).toBeVisible();
    });

    test('Fehlermeldung bei falschem Passwort', async ({ page }) => {
        await page.locator('input[type="text"]').fill('Admin User');
        await page.locator('input[type="password"]').fill('FalschesPasswort!');
        await page.getByRole('button', { name: /anmelden/i }).click();
        await expect(page.getByText(/ungültiger benutzername/i)).toBeVisible();
    });

    test('Erfolgreicher Login als Admin', async ({ page }) => {
        await page.locator('input[type="text"]').fill('Admin User');
        await page.locator('input[type="password"]').fill('admin');
        await page.getByRole('button', { name: /anmelden/i }).click();

        // App-Header muss erscheinen
        await expect(page.locator('header.app-header')).toBeVisible();

        // Username im Header (exakter Match, da Toast auch "Admin User" enthält)
        await expect(page.locator('header.app-header').getByText('Admin User', { exact: true })).toBeVisible();
    });

    test('Erfolgreicher Login als Techniker', async ({ page }) => {
        await page.locator('input[type="text"]').fill('Techniker 1');
        await page.locator('input[type="password"]').fill('123');
        await page.getByRole('button', { name: /anmelden/i }).click();

        await expect(page.locator('header.app-header')).toBeVisible();
        await expect(page.locator('header.app-header').getByText('Techniker 1', { exact: true })).toBeVisible();
    });

    test('Logout funktioniert', async ({ page }) => {
        // Einloggen
        await page.locator('input[type="text"]').fill('Admin User');
        await page.locator('input[type="password"]').fill('admin');
        await page.getByRole('button', { name: /anmelden/i }).click();
        await page.locator('header.app-header').waitFor();

        // Ausloggen
        await page.locator('button[title="Abmelden"]').click();

        // Login-Screen soll erscheinen
        await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
    });

});
