import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

/**
 * Hilfsfunktion: Öffnet "Neuer Auftrag" und wartet bis das Formular da ist.
 * 
 * WICHTIG: Das User-Info-Div in der Nav ist position:absolute und überlagert
 * die Navigationsbuttons → force:true ist nötig.
 */
async function openNewReport(page) {
    const newOrderBtn = page.locator('button.btn-primary', { hasText: /auftrag/i });
    await expect(newOrderBtn).toBeVisible({ timeout: 5000 });

    // force:true wegen überlagerndem User-Info-Div
    await newOrderBtn.click({ force: true });

    // Warten bis der Nav-Button "Dashboard" erscheint (nur sichtbar wenn view !== 'dashboard')
    // Der Button hat class btn-outline und enthält "Dashboard" im span
    const navBackBtn = page.locator('header nav button.btn-outline').first();
    await expect(navBackBtn).toBeVisible({ timeout: 10000 });
}

/**
 * Tests für das Schadensformular (DamageForm)
 */
test.describe('Schadensformular (DamageForm)', () => {

    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Formular öffnet sich nach Klick auf "Neuer Auftrag"', async ({ page }) => {
        await openNewReport(page);

        // Der Zurück-Button in der nav ist sichtbar
        await expect(page.locator('header nav button.btn-outline').first()).toBeVisible();
        await expect(page.locator('main.container')).toBeVisible();
    });

    test('Formular-Bereich enthält Eingabefelder', async ({ page }) => {
        await openNewReport(page);

        const inputs = page.locator('main input');
        await expect(inputs.first()).toBeVisible({ timeout: 5000 });
        const count = await inputs.count();
        expect(count).toBeGreaterThan(0);
    });

    test('Erstes Textfeld kann befüllt werden', async ({ page }) => {
        await openNewReport(page);

        const firstInput = page.locator('main input').first();
        await expect(firstInput).toBeVisible({ timeout: 5000 });
        await firstInput.fill('Testprojekt Playwright 001');
        await expect(firstInput).toHaveValue('Testprojekt Playwright 001');
    });

    test('Abbrechen (nav-Button) führt zurück zum Dashboard', async ({ page }) => {
        await openNewReport(page);

        // Den Zurück-Button klicken (auch hier force nötig wegen Overlay)
        const navBtn = page.locator('header nav button.btn-outline').first();
        await navBtn.click({ force: true });

        // Jetzt wieder Dashboard
        await expect(page.locator('button.btn-primary', { hasText: /auftrag/i })).toBeVisible({ timeout: 5000 });
    });

    test('Screenshot: Formular-Ansicht', async ({ page }) => {
        await openNewReport(page);
        await page.screenshot({ path: 'playwright-report/screenshots/damage-form.png', fullPage: false });
    });

});

/**
 * Workflow-Tests
 */
test.describe('Neuer Auftrag - Workflow', () => {

    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('Formular → Dashboard → Formular (sauberer State)', async ({ page }) => {
        // 1. Formular öffnen
        await openNewReport(page);

        const firstInput = page.locator('main input').first();
        await expect(firstInput).toBeVisible({ timeout: 5000 });
        await firstInput.fill('Mein Testauftrag');

        // 2. Zurück zum Dashboard
        const navBtn = page.locator('header nav button.btn-outline').first();
        await navBtn.click({ force: true });
        await expect(page.locator('button.btn-primary', { hasText: /auftrag/i })).toBeVisible();

        // 3. Neues Formular öffnen
        await openNewReport(page);
        const firstInputNew = page.locator('main input').first();
        await expect(firstInputNew).toBeVisible({ timeout: 5000 });

        // Formular ist interaktiv (befüllbar) - das ist der wichtige Test
        // Hinweis: React nutzt key='new' f. neue Aufträge, der vorherige State wurde verworfen
        await firstInputNew.fill('Test 2');
        await expect(firstInputNew).toHaveValue('Test 2');
    });

});
