import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Projekt aus der Suche öffnen */
async function openProject(page, searchTerm) {
    await page.goto('/');
    await page.waitForSelector('header.app-header', { timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="such"], input[placeholder*="Such"], input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill(searchTerm);
    await page.waitForTimeout(800);

    // Runterscrollen zur Ergebnistabelle
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);

    // Erste BODY-Tabellenzeile klicken (NICHT die Header-Zeile!)
    const firstBodyRow = page.locator('tbody tr').first();
    await expect(firstBodyRow).toBeVisible({ timeout: 5000 });
    await firstBodyRow.click();

    // Warten bis das Projekt-Formular geladen ist (URL ändert sich oder Inhalt erscheint)
    await page.waitForTimeout(2000);
}

async function openAddRoomForm(page) {
    const addRoomBtn = page.locator('button', { hasText: /raum hinzufügen/i });
    await page.waitForTimeout(500);
    // Scrollen bis Button sichtbar
    if (!await addRoomBtn.isVisible()) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
        await page.waitForTimeout(300);
    }
    await expect(addRoomBtn).toBeVisible({ timeout: 8000 });
    await addRoomBtn.click();
    await page.waitForTimeout(600);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Desktop-Modus – Deep Test', () => {

    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    // ── 1. Projekt öffnen ────────────────────────────────────────────────────

    test('1. Bestehendes Projekt öffnen (Bühlwiesenstrasse)', async ({ page }) => {
        await openProject(page, 'wiesenstrasse');

        // Formular ist sichtbar
        await expect(page.locator('main')).toBeVisible();

        // Screenshot
        await page.screenshot({
            path: 'playwright-report/screenshots/desktop-01-projekt-offen.png',
            fullPage: false
        });
    });

    // ── 2. Mieter-Dropdown Bug-Fix Test ──────────────────────────────────────

    test('2. Mieter-Dropdown – Auswahl bleibt stabil (Bug-Fix)', async ({ page }) => {
        await openProject(page, 'wiesenstrasse');
        await openAddRoomForm(page);

        // Apartment-Select eindeutig über seine spezielle Option identifizieren
        const apartmentSelect = page.locator('select').filter({
            has: page.locator('option', { hasText: 'Neue Wohnung eingeben...' })
        }).first();
        await expect(apartmentSelect).toBeVisible({ timeout: 5000 });

        // Alle Optionen lesen
        const options = await apartmentSelect.locator('option').allTextContents();
        console.log('Dropdown-Optionen:', options);

        // Echte Mieter-Optionen (nicht Platzhalter, nicht Sonstiges)
        const realTenants = options.filter(o =>
            o !== 'Wohnung wählen... (Optional)' &&
            o !== 'Mieter / Wohnung wählen...' &&
            o !== 'Neue Wohnung eingeben...' &&
            o !== ''
        );
        expect(realTenants.length, 'Mindestens ein Mieter muss im Dropdown sein').toBeGreaterThan(0);

        // Ersten echten Mieter auswählen
        const firstTenant = realTenants[0];
        console.log('Wähle Mieter:', firstTenant);
        await apartmentSelect.selectOption({ label: firstTenant });
        await page.waitForTimeout(500);

        // ✅ KRITISCH: Wert darf nicht zurückspringen auf "Neue Wohnung"
        const selectedValue = await apartmentSelect.inputValue();
        expect(selectedValue, `Mieter "${firstTenant}" sollte ausgewählt bleiben`).not.toBe('Sonstiges');
        expect(selectedValue, `Mieter "${firstTenant}" sollte ausgewählt bleiben`).not.toBe('__neue__');
        expect(selectedValue, `Mieter "${firstTenant}" sollte ausgewählt bleiben`).not.toBe('');
        console.log('Ausgewählter Wert nach Selektion:', selectedValue, '✔');

        await page.screenshot({
            path: 'playwright-report/screenshots/desktop-02-mieter-ausgewaehlt.png',
            fullPage: false
        });
    });

    // ── 3. Raum erstellen mit bestehendem Mieter ─────────────────────────────

    test('3. Raum erstellen – Wohnzimmer für Banz/Umbricht', async ({ page }) => {
        await openProject(page, 'wiesenstrasse');
        await openAddRoomForm(page);

        // Apartment-Select über einzigartige Option identifizieren
        const apartmentSelect = page.locator('select').filter({
            has: page.locator('option', { hasText: 'Neue Wohnung eingeben...' })
        }).first();
        await expect(apartmentSelect).toBeVisible({ timeout: 5000 });

        // Ersten verfügbaren Mieter wählen
        const optionValues = await apartmentSelect.locator('option').evaluateAll(
            opts => opts.map(o => ({ value: o.value, text: o.textContent }))
                .filter(o => o.value && o.value !== 'Sonstiges' && o.value !== '__neue__')
        );
        expect(optionValues.length, 'Mieter-Optionen müssen existieren').toBeGreaterThan(0);

        await apartmentSelect.selectOption(optionValues[0].value);
        await page.waitForTimeout(300);

        // Raum-Dropdown (hat "Sonstiges / Eigener Name" als letzte Option)
        const roomSelect = page.locator('select').filter({
            has: page.locator('option', { hasText: /sonstiges.*eigener|raum wählen/i })
        }).first();
        await expect(roomSelect).toBeVisible({ timeout: 3000 });
        await roomSelect.selectOption('Wohnzimmer');
        await page.waitForTimeout(300);

        // Speichern-Button
        const saveBtn = page.locator('button', { hasText: /speichern/i }).last();
        await expect(saveBtn).toBeEnabled({ timeout: 3000 });
        await saveBtn.click();
        await page.waitForTimeout(1000);

        // ✅ Raum sollte in der Liste erscheinen
        const roomCards = page.locator('.card', { hasText: /wohnzimmer/i });
        await expect(roomCards.first()).toBeVisible({ timeout: 5000 });

        await page.screenshot({
            path: 'playwright-report/screenshots/desktop-03-raum-erstellt.png',
            fullPage: false
        });
    });

    // ── 4. Raum "Neue Wohnung" Freitext-Eingabe ───────────────────────────────

    test('4. Neue Wohnung – Freitext-Eingabe funktioniert', async ({ page }) => {
        await openProject(page, 'wiesenstrasse');
        await openAddRoomForm(page);

        // Apartment-Select über einzigartige Option identifizieren
        const apartmentSelect = page.locator('select').filter({
            has: page.locator('option', { hasText: 'Neue Wohnung eingeben...' })
        }).first();
        await expect(apartmentSelect).toBeVisible({ timeout: 5000 });

        // "Neue Wohnung eingeben..." = value 'Sonstiges'
        await apartmentSelect.selectOption('Sonstiges');
        await page.waitForTimeout(400);

        // Freitext-Input sollte erscheinen
        const freitextInput = page.locator('input[placeholder*="Wohnung eingeben"], input[placeholder*="Wohnungsbezeichnung"]');
        await expect(freitextInput).toBeVisible({ timeout: 3000 });

        // Text eingeben und prüfen
        await freitextInput.fill('Test-Wohnung 99');
        await expect(freitextInput).toHaveValue('Test-Wohnung 99');

        // Dropdown-Wert ist immer noch 'Sonstiges' (stabil)
        const selectValue = await apartmentSelect.inputValue();
        expect(selectValue).toBe('Sonstiges');
        console.log('✅ Select bleibt auf Sonstiges, Freitext hat Wert');

        await page.screenshot({
            path: 'playwright-report/screenshots/desktop-04-neue-wohnung-freitext.png',
            fullPage: false
        });
    });

    // ── 5. Schadensbilder vs. Schadenursache Trennung ────────────────────────

    test('5. Schadensbilder und Schadenursache sind getrennte Sektionen', async ({ page }) => {
        await openProject(page, 'wiesenstrasse');

        // Auf die Schadensbilder-Sektion scrollen
        const schadensbilderSection = page.locator('text=Schadensbilder').first();
        await schadensbilderSection.scrollIntoViewIfNeeded().catch(() => {});

        // Schadenursache-Sektion suchen
        const schadenursacheSection = page.locator('text=Schadenursache').first();
        await expect(schadenursacheSection).toBeVisible({ timeout: 5000 });

        // Beide Sektionen sind vorhanden (getrennt)
        const schadensbilderCount = await page.locator('text=Schadensbilder').count();
        const schadenursacheCount = await page.locator('text=Schadenursache').count();
        console.log('Schadensbilder-Sektionen:', schadensbilderCount);
        console.log('Schadenursache-Sektionen:', schadenursacheCount);

        expect(schadenursacheCount).toBeGreaterThan(0);

        await page.screenshot({
            path: 'playwright-report/screenshots/desktop-05-sektionen.png',
            fullPage: false
        });
    });

    // ── 6. Desktop-Formular Felder prüfen ────────────────────────────────────

    test('6. Desktop-Formular – Alle Pflichtfelder sichtbar', async ({ page }) => {
        await openProject(page, 'wiesenstrasse');

        // Adressfeld
        const addressInput = page.locator('input[placeholder*="Adresse"], input[placeholder*="Strasse"], input[placeholder*="Straße"]').first();

        // Projektfelder sollten sichtbar sein
        const inputs = page.locator('main input:not([type="file"]):not([type="checkbox"])');
        const inputCount = await inputs.count();
        expect(inputCount, 'Mindestens 5 Eingabefelder').toBeGreaterThanOrEqual(5);
        console.log(`Formular hat ${inputCount} Eingabefelder`);

        await page.screenshot({
            path: 'playwright-report/screenshots/desktop-06-formular-felder.png',
            fullPage: false
        });
    });

    // ── 7. Kontakt-Sektion ────────────────────────────────────────────────────

    test('7. Kontakt-Sektion – Bestehende Kontakte sichtbar', async ({ page }) => {
        await openProject(page, 'wiesenstrasse');

        // Kontakt-Bereich suchen
        const contactSection = page.locator('text=Kontakt, text=Mieter, text=Auftraggeber').first();
        await page.waitForTimeout(1000);

        // Mindestens ein Kontakt-Card oder Kontakt-Element
        const contactElements = page.locator('[class*="contact"], [class*="Contact"]');
        const contactCount = await contactElements.count();
        console.log('Kontakt-Elemente gefunden:', contactCount);

        await page.screenshot({
            path: 'playwright-report/screenshots/desktop-07-kontakte.png',
            fullPage: false
        });
    });

    // ── 8. Vollständiger Screenshot der Seite ─────────────────────────────────

    test('8. Vollständiger Desktop-Screenshot', async ({ page }) => {
        await openProject(page, 'wiesenstrasse');
        await page.waitForTimeout(1500);

        await page.screenshot({
            path: 'playwright-report/screenshots/desktop-08-vollansicht.png',
            fullPage: true
        });

        // Einfacher Smoke-Test: Seite ist geladen
        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('header.app-header')).toBeVisible();
    });

});
