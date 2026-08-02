/**
 * Auth-Hilfsfunktionen für QTool Playwright Tests
 */

/**
 * Meldet einen Benutzer an der QTool-App an.
 * 
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {string} options.name     - Benutzername (default: 'Admin User')
 * @param {string} options.password - Passwort      (default: 'admin')
 */
export async function login(page, { name = 'Admin User', password = 'admin' } = {}) {
    await page.goto('/');

    // Warten, bis entweder das Anmeldeformular oder die Dashboard-Kopfzeile geladen ist
    await Promise.race([
        page.waitForSelector('input[type="password"]', { timeout: 10000 }).catch(() => null),
        page.waitForSelector('header.app-header', { timeout: 10000 }).catch(() => null)
    ]);

    // Falls wir schon eingeloggt sind, nichts tun
    const isLoginVisible = await page.locator('input[type="password"]').isVisible().catch(() => false);
    if (!isLoginVisible) return;

    // Name eingeben
    await page.locator('input[type="text"]').fill(name);

    // Passwort eingeben
    await page.locator('input[type="password"]').fill(password);

    // Anmelden klicken
    await page.getByRole('button', { name: /anmelden/i }).click();

    // Warten bis der Header/Dashboard sichtbar ist
    await page.waitForSelector('header.app-header', { timeout: 5000 });
}

/**
 * Meldet den aktuellen Benutzer ab.
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
    // Der Logout-Button hat title="Abmelden"
    const logoutBtn = page.locator('button[title="Abmelden"]');
    if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
    }
}
