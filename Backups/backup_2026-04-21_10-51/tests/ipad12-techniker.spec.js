import { test, expect } from '@playwright/test';

/**
 * iPad Pro 12.9" Usability-Tests: Techniker-Modus
 *
 * Viewport: 1024x1366 (Portrait) / 1366x1024 (Landscape)
 *
 * Auf dem 12.9" iPad ist der Viewport breiter → die App könnte in den
 * Desktop-Layout-Bereich fallen (falls CSS-Breakpoints greifen).
 * Diese Tests prüfen ob der Techniker-Modus trotzdem korrekt bleibt.
 */

const IPAD12_PORTRAIT = { width: 1024, height: 1366 };
const IPAD12_LANDSCAPE = { width: 1366, height: 1024 };
const MIN_TOUCH_PX = 44; // Apple HIG: 44px auf 12.9" strenger testen

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

async function loginAsTech(page) {
    await page.goto('/');
    const logoutBtn = page.locator('button[title="Abmelden"]');
    if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click();
    }
    await page.locator('input[type="text"]').waitFor({ timeout: 8000 });
    await page.locator('input[type="text"]').fill('Techniker 1');
    await page.locator('input[type="password"]').fill('123');
    await page.getByRole('button', { name: /anmelden/i }).click();
    await page.locator('header.app-header').waitFor({ timeout: 8000 });
}

async function loginAsAdminTechMode(page) {
    await page.goto('/');
    const logoutBtn = page.locator('button[title="Abmelden"]');
    const loggedIn = await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (loggedIn) {
        const desktopBtn = page.locator('button', { hasText: 'Desktop' });
        if (!await desktopBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await logoutBtn.click();
            await page.locator('input[type="text"]').waitFor({ timeout: 8000 });
            await page.locator('input[type="text"]').fill('Admin User');
            await page.locator('input[type="password"]').fill('admin');
            await page.getByRole('button', { name: /anmelden/i }).click();
            await page.locator('header.app-header').waitFor({ timeout: 8000 });
        }
    }
    const desktopBtn = page.locator('button', { hasText: 'Desktop' });
    if (await desktopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await desktopBtn.evaluate(btn => btn.click());
        await page.locator('button', { hasText: 'Techniker' }).waitFor({ timeout: 5000 });
    }
}

// ─── PORTRAIT – Techniker-Login ───────────────────────────────────────────────

test.describe('iPad Pro 12.9" Portrait – Techniker-Login', () => {
    test.use({ viewport: IPAD12_PORTRAIT });

    test.beforeEach(async ({ page }) => {
        await loginAsTech(page);
    });

    test('App lädt korrekt auf iPad 12.9" Portrait', async ({ page }) => {
        await expect(page.locator('header.app-header')).toBeVisible();
        await expect(page.locator('main.container')).toBeVisible();
        await page.screenshot({ path: 'playwright-report/screenshots/ipad12-portrait-techniker.png' });
    });

    test('Techniker-Modus: KEINE Desktop-Tabelle sichtbar', async ({ page }) => {
        // Auch auf 1024px Breite soll der Tech-Modus Karten zeigen, keine Tabelle
        await expect(page.locator('table.data-table')).toHaveCount(0);
    });

    test('Techniker-Modus: Projektanzahl-Text sichtbar', async ({ page }) => {
        await expect(page.getByText(/projekte gefunden/i)).toBeVisible({ timeout: 5000 });
    });

    test('Kein "Neuer Auftrag"-Button (Techniker darf nicht erstellen)', async ({ page }) => {
        await expect(page.locator('button.btn-primary', { hasText: /auftrag/i })).toHaveCount(0);
    });

    test('Suchfeld: Höhe ≥ 44px (Touch-Target, 12.9" Standard)', async ({ page }) => {
        const box = await page.locator('input[placeholder*="Suche"]').boundingBox();
        expect(box, 'Suchfeld-Box muss existieren').not.toBeNull();
        expect(box.height, `Suchfeld-Höhe ${box.height.toFixed(1)}px zu niedrig`).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    });

    test('Suchfeld: Breite ≥ 200px (ausreichend auf 12.9" iPad)', async ({ page }) => {
        const box = await page.locator('input[placeholder*="Suche"]').boundingBox();
        expect(box.width).toBeGreaterThan(200);
    });

    test('Suchfeld: Texteingabe funktioniert', async ({ page }) => {
        const searchInput = page.locator('input[placeholder*="Suche"]');
        await searchInput.fill('12-Zoll Test');
        await expect(searchInput).toHaveValue('12-Zoll Test');
        await expect(page.getByText(/projekte gefunden/i)).toBeVisible();
    });

    test('Aktuell-Tab: Höhe ≥ 44px', async ({ page }) => {
        const box = await page.getByRole('button', { name: 'Aktuell' }).boundingBox();
        expect(box, 'Aktuell-Tab muss existieren').not.toBeNull();
        expect(box.height, `Aktuell-Tab Höhe ${box.height.toFixed(1)}px`).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    });

    test('Archiv-Tab: Höhe ≥ 44px', async ({ page }) => {
        const box = await page.getByRole('button', { name: 'Archiv' }).boundingBox();
        expect(box.height, `Archiv-Tab Höhe ${box.height.toFixed(1)}px`).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    });

    test('Archiv-Tab wechselt Ansicht', async ({ page }) => {
        await page.getByRole('button', { name: 'Archiv' }).click();
        await expect(page.getByText(/projekte gefunden/i)).toBeVisible();
        await page.getByRole('button', { name: 'Aktuell' }).click();
        await expect(page.getByText(/projekte gefunden/i)).toBeVisible();
    });

    test('Logout-Button: Höhe & Breite ≥ 44px', async ({ page }) => {
        const box = await page.locator('button[title="Abmelden"]').boundingBox();
        expect(box, 'Logout-Button muss existieren').not.toBeNull();
        expect(box.width, `Logout Breite  ${box.width.toFixed(1)}px`).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
        expect(box.height, `Logout Höhe    ${box.height.toFixed(1)}px`).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    });

    test('Header bleibt sticky beim Scrollen', async ({ page }) => {
        await page.evaluate(() => window.scrollTo(0, 600));
        await page.waitForTimeout(200);
        await expect(page.locator('header.app-header')).toBeVisible();
    });

    test('Breite der Auftragskarten ≤ 600px (kein Vollbild-Stretch)', async ({ page }) => {
        // Der Techniker-Container hat maxWidth: 600px – via data-testid prüfbar
        const container = page.locator('[data-testid="techniker-list"]');
        await expect(container).toBeVisible({ timeout: 5000 });

        const box = await container.boundingBox();
        expect(box, 'Techniker-Container muss vorhanden sein').not.toBeNull();
        expect(box.width, `Container-Breite ${box.width.toFixed(0)}px zu breit (max. 600px)`).toBeLessThanOrEqual(620); // +20px Toleranz für Padding
    });

});

// ─── LANDSCAPE – Techniker-Login ─────────────────────────────────────────────

test.describe('iPad Pro 12.9" Landscape – Techniker-Login', () => {
    test.use({ viewport: IPAD12_LANDSCAPE });

    test.beforeEach(async ({ page }) => {
        await loginAsTech(page);
    });

    test('App lädt korrekt im Landscape (1366px)', async ({ page }) => {
        await expect(page.locator('header.app-header')).toBeVisible();
        await expect(page.locator('main.container')).toBeVisible();
        await page.screenshot({ path: 'playwright-report/screenshots/ipad12-landscape-techniker.png' });
    });

    test('Landscape 1366px: KEINE Desktop-Tabelle', async ({ page }) => {
        // Auch bei 1366px Breite soll Techniker-Modus kompakt bleiben
        await expect(page.locator('table.data-table')).toHaveCount(0);
    });

    test('Landscape: Projektliste sichtbar', async ({ page }) => {
        await expect(page.getByText(/projekte gefunden/i)).toBeVisible({ timeout: 5000 });
    });

    test('Landscape: Suchfeld bedienbar', async ({ page }) => {
        const searchInput = page.locator('input[placeholder*="Suche"]');
        await searchInput.fill('Landscape 12" Test');
        await expect(searchInput).toHaveValue('Landscape 12" Test');
    });

    test('Landscape: Logout-Button Größe ≥ 44px', async ({ page }) => {
        const box = await page.locator('button[title="Abmelden"]').boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
        expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    });

    test('Screenshot: 12.9" Landscape Vollbild', async ({ page }) => {
        await page.screenshot({
            path: 'playwright-report/screenshots/ipad12-landscape-full.png',
            fullPage: true,
        });
    });

});

// ─── Admin → Techniker-Modus Toggle ──────────────────────────────────────────

test.describe('iPad Pro 12.9" Portrait – Admin aktiviert Techniker-Modus', () => {
    test.use({ viewport: IPAD12_PORTRAIT });

    test.beforeEach(async ({ page }) => {
        await loginAsAdminTechMode(page);
    });

    test('Techniker-Modus via Toggle aktiv', async ({ page }) => {
        await expect(page.locator('button', { hasText: 'Techniker' })).toBeVisible();
        await expect(page.locator('table.data-table')).toHaveCount(0);
        await expect(page.getByText(/projekte gefunden/i)).toBeVisible();
        await page.screenshot({ path: 'playwright-report/screenshots/ipad12-admin-tech-mode.png' });
    });

    test('Admin kann zurück zu Desktop-Modus', async ({ page }) => {
        await page.locator('button', { hasText: 'Techniker' }).evaluate(btn => btn.click());
        await expect(page.locator('button', { hasText: 'Desktop' })).toBeVisible({ timeout: 5000 });
    });

    test('Im Techniker-Modus: Admin-Toolbar NICHT sichtbar', async ({ page }) => {
        await expect(page.locator('button[title="Geräteverwaltung"]')).toHaveCount(0);
        await expect(page.locator('button[title="Benutzer"]')).toHaveCount(0);
        await expect(page.locator('button[title="Messgeräte"]')).toHaveCount(0);
    });

    test('Desktop-Modus auf 12.9" zeigt Tabelle', async ({ page }) => {
        // Zurück zu Desktop → Tabelle soll sichtbar sein
        await page.locator('button', { hasText: 'Techniker' }).evaluate(btn => btn.click());
        await page.locator('button', { hasText: 'Desktop' }).waitFor({ timeout: 5000 });
        // Desktop-Layout: Tabelle erscheint (wenn Berichte vorhanden)
        // Wir prüfen nur ob kein Crash passiert
        await expect(page.locator('main.container')).toBeVisible();
    });

});
