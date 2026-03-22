import { test, expect } from '@playwright/test';

/**
 * iPad 11" Usability-Tests: Techniker-Modus
 * 
 * Viewport: 820x1180 (Portrait) / 1180x820 (Landscape)
 * 
 * WICHTIG: Die App startet immer direkt als Admin (useState-Default in App.jsx Zeile 34).
 * Echter Techniker-Login = Logout klicken → dann als Techniker anmelden.
 * 
 * Gefundener Bug: Logout-Button ist nur ~29px breit (Apple HIG: min. 44px für Touch!)
 */

const IPAD_PORTRAIT = { width: 820, height: 1180 };
const IPAD_LANDSCAPE = { width: 1180, height: 820 };
const MIN_TOUCH_PX = 34;

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Logout falls eingeloggt, dann als Techniker anmelden */
async function loginAsTech(page) {
    await page.goto('/');

    // Falls schon eingeloggt: Logout klicken
    const logoutBtn = page.locator('button[title="Abmelden"]');
    if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click();
    }

    // Login-Screen warten
    await page.locator('input[type="text"]').waitFor({ timeout: 8000 });
    await page.locator('input[type="text"]').fill('Techniker 1');
    await page.locator('input[type="password"]').fill('123');
    await page.getByRole('button', { name: /anmelden/i }).click();
    await page.locator('header.app-header').waitFor({ timeout: 8000 });
}

/** Als Admin einloggen + Techniker-Modus aktivieren */
async function loginAsAdminTechMode(page) {
    await page.goto('/');

    // Falls eingeloggt als Techniker oder anderer User → erst logout
    const logoutBtn = page.locator('button[title="Abmelden"]');
    const loggedIn = await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (loggedIn) {
        // Prüfe ob schon als Admin → direkt Techniker-Toggle
        const desktopBtn = page.locator('button', { hasText: 'Desktop' });
        const isAdmin = await desktopBtn.isVisible({ timeout: 1000 }).catch(() => false);
        if (!isAdmin) {
            // Eingeloggt aber nicht als Admin → neu einloggen
            await logoutBtn.click();
            await page.locator('input[type="text"]').waitFor({ timeout: 8000 });
            await page.locator('input[type="text"]').fill('Admin User');
            await page.locator('input[type="password"]').fill('admin');
            await page.getByRole('button', { name: /anmelden/i }).click();
            await page.locator('header.app-header').waitFor({ timeout: 8000 });
        }
    } else {
        // Direkt als Admin (App-Default) – kein extra Login nötig
    }

    // Techniker-Toggle aktivieren
    const desktopBtn = page.locator('button', { hasText: 'Desktop' });
    if (await desktopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await desktopBtn.evaluate(btn => btn.click());
        await page.locator('button', { hasText: 'Techniker' }).waitFor({ timeout: 5000 });
    }
}

// ─── PORTRAIT – Techniker-Login ───────────────────────────────────────────────

test.describe('iPad 11" Portrait – Techniker-Login', () => {
    test.use({ viewport: IPAD_PORTRAIT });

    test.beforeEach(async ({ page }) => {
        await loginAsTech(page);
    });

    test('App lädt korrekt auf iPad 11" Portrait', async ({ page }) => {
        await expect(page.locator('header.app-header')).toBeVisible();
        await expect(page.locator('main.container')).toBeVisible();
        await page.screenshot({ path: 'playwright-report/screenshots/ipad-portrait-techniker.png' });
    });

    test('Techniker-Modus: KEINE Desktop-Tabelle sichtbar', async ({ page }) => {
        // Techniker sehen kompakte Karten, keine data-table
        await expect(page.locator('table.data-table')).toHaveCount(0);
    });

    test('Techniker-Modus: Projektanzahl-Text sichtbar', async ({ page }) => {
        await expect(page.getByText(/projekte gefunden/i)).toBeVisible({ timeout: 5000 });
    });

    test('Kein "Neuer Auftrag"-Button (Techniker dürfen nicht erstellen)', async ({ page }) => {
        const newBtn = page.locator('button.btn-primary', { hasText: /auftrag/i });
        await expect(newBtn).toHaveCount(0);
    });

    test('Suchfeld: Höhe ≥ 34px (Touch-freundlich)', async ({ page }) => {
        const box = await page.locator('input[placeholder*="Suche"]').boundingBox();
        expect(box, 'Suchfeld-Box existiert').not.toBeNull();
        expect(box.height, `Suchfeld-Höhe ${box.height.toFixed(1)}px zu niedrig`).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    });

    test('Suchfeld: Breite ≥ 150px (lesbar auf iPad)', async ({ page }) => {
        const box = await page.locator('input[placeholder*="Suche"]').boundingBox();
        expect(box.width).toBeGreaterThan(150);
    });

    test('Suchfeld: Texteingabe funktioniert', async ({ page }) => {
        const searchInput = page.locator('input[placeholder*="Suche"]');
        await searchInput.fill('Muster');
        await expect(searchInput).toHaveValue('Muster');
        await expect(page.getByText(/projekte gefunden/i)).toBeVisible();
    });

    test('Aktuell-Tab ist aktiv und klickbar', async ({ page }) => {
        const aktuellBtn = page.getByRole('button', { name: 'Aktuell' });
        await expect(aktuellBtn).toBeVisible();
        const box = await aktuellBtn.boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    });

    test('Archiv-Tab wechselt Ansicht', async ({ page }) => {
        const archivBtn = page.getByRole('button', { name: 'Archiv' });
        await expect(archivBtn).toBeVisible();
        await archivBtn.click();
        await expect(page.getByText(/projekte gefunden/i)).toBeVisible();
        // Zurück
        await page.getByRole('button', { name: 'Aktuell' }).click();
    });

    test('⚠️ BUG DOKUMENTIERT: Logout-Button zu schmal für Touch', async ({ page }) => {
        // Apple Human Interface Guidelines: min 44×44px Touch-Target
        const logoutBtn = page.locator('button[title="Abmelden"]');
        await expect(logoutBtn).toBeVisible();

        const box = await logoutBtn.boundingBox();
        console.warn(
            `\n⚠️  BUG: Logout-Button Touch-Target zu klein!\n` +
            `   Größe: ${box.width.toFixed(1)}px × ${box.height.toFixed(1)}px\n` +
            `   Soll: min. 44×44px (Apple HIG)\n` +
            `   Fix: padding erhöhen auf 0.75rem oder min-width/height: 44px setzen`
        );

        // Test schlägt fehl um den Bug sichtbar zu machen:
        expect(box.width, `Logout-Button Breite ${box.width.toFixed(1)}px < 34px`).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    });

    test('Header bleibt sticky beim Scrollen', async ({ page }) => {
        await page.evaluate(() => window.scrollTo(0, 500));
        await page.waitForTimeout(200);
        await expect(page.locator('header.app-header')).toBeVisible();
    });

});

// ─── LANDSCAPE – Techniker-Login ─────────────────────────────────────────────

test.describe('iPad 11" Landscape – Techniker-Login', () => {
    test.use({ viewport: IPAD_LANDSCAPE });

    test.beforeEach(async ({ page }) => {
        await loginAsTech(page);
    });

    test('App lädt korrekt im Landscape', async ({ page }) => {
        await expect(page.locator('header.app-header')).toBeVisible();
        await expect(page.locator('main.container')).toBeVisible();
        await page.screenshot({ path: 'playwright-report/screenshots/ipad-landscape-techniker.png' });
    });

    test('Landscape: KEINE Desktop-Tabelle', async ({ page }) => {
        await expect(page.locator('table.data-table')).toHaveCount(0);
    });

    test('Landscape: Projektliste sichtbar', async ({ page }) => {
        await expect(page.getByText(/projekte gefunden/i)).toBeVisible({ timeout: 5000 });
    });

    test('Landscape: Suchfeld bedienbar', async ({ page }) => {
        const searchInput = page.locator('input[placeholder*="Suche"]');
        await searchInput.fill('Landscape Test');
        await expect(searchInput).toHaveValue('Landscape Test');
    });

    test('Screenshot: Landscape Vollbild', async ({ page }) => {
        await page.screenshot({
            path: 'playwright-report/screenshots/ipad-landscape-full.png',
            fullPage: true,
        });
    });

});

// ─── Admin → Techniker-Modus Toggle ──────────────────────────────────────────

test.describe('iPad 11" Portrait – Admin aktiviert Techniker-Modus', () => {
    test.use({ viewport: IPAD_PORTRAIT });

    test.beforeEach(async ({ page }) => {
        await loginAsAdminTechMode(page);
    });

    test('Techniker-Modus via Toggle aktiv', async ({ page }) => {
        await expect(page.locator('button', { hasText: 'Techniker' })).toBeVisible();
        await expect(page.locator('table.data-table')).toHaveCount(0);
        await expect(page.getByText(/projekte gefunden/i)).toBeVisible();

        await page.screenshot({ path: 'playwright-report/screenshots/ipad-admin-tech-mode.png' });
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

});
