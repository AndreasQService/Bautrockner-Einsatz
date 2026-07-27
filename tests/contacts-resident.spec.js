import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

async function openNewReport(page) {
    const newOrderBtn = page.locator('button.btn-primary', { hasText: /auftrag/i });
    await expect(newOrderBtn).toBeVisible({ timeout: 5000 });
    await newOrderBtn.click({ force: true });
    
    const navBackBtn = page.locator('header nav button.btn-outline').first();
    await expect(navBackBtn).toBeVisible({ timeout: 10000 });
}

test.describe('Contacts Resident and Syncing Flow', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display Auftraggeber and Eigentümer always and sync resident status and names bi-directionally', async ({ page }) => {
        await openNewReport(page);

        // 1. Verify global checkboxes on "Auftrag und Schadenort" tab are unchecked by default
        const globalAgResidentInput = page.locator('label', { hasText: 'Auftraggeber ist gleichzeitig Bewohner' }).locator('input[type="checkbox"]');
        const globalEigResidentInput = page.locator('label', { hasText: 'Eigentümer ist gleichzeitig Bewohner' }).locator('input[type="checkbox"]');
        await expect(globalAgResidentInput).not.toBeChecked();
        await expect(globalEigResidentInput).not.toBeChecked();

        // 2. Go to "Kontakte" tab and verify cards are NOT visible by default
        const kontakteTabBtn = page.locator('button', { hasText: 'Kontakte' }).first();
        await expect(kontakteTabBtn).toBeVisible();
        await kontakteTabBtn.click({ force: true });

        const agCard = page.locator('div.glass-card', { hasText: /Auftraggeber/ }).first();
        const eigCard = page.locator('div.glass-card', { hasText: /Eigentümer/ }).first();
        await expect(agCard).not.toBeVisible();
        await expect(eigCard).not.toBeVisible();

        // 3. Switch back to "Auftrag und Schadenort" tab and check checkboxes
        const auftragTabBtn = page.locator('button', { hasText: 'Auftrag und Schadenort' }).first();
        await expect(auftragTabBtn).toBeVisible();
        await auftragTabBtn.click({ force: true });

        await globalAgResidentInput.check({ force: true });
        await globalEigResidentInput.check({ force: true });

        // Wait for the first auto-save to complete and generate the project ID.
        // This causes the DamageForm component to remount (due to key change),
        // which resets the tab to "Auftrag". We wait for the toast to ensure
        // the remount has finished before we switch tabs.
        const toast = page.locator('text=Projekt erfolgreich gespeichert!');
        await expect(toast).toBeVisible({ timeout: 15000 });

        // 4. Go to "Kontakte" tab and verify cards are now visible
        await kontakteTabBtn.click({ force: true });
        await expect(agCard).toBeVisible();
        await expect(eigCard).toBeVisible();

        // 5. Change the Auftraggeber Name in the main "Auftrag" form
        await auftragTabBtn.click({ force: true });
        const clientInput = page.locator('input[placeholder*="Name oder Firma des Auftraggebers"]').first();
        await expect(clientInput).toBeVisible();
        await clientInput.fill('Musterfirma AG');

        // Wait for auto-save toast to settle after typing
        await expect(toast).toBeVisible({ timeout: 15000 });

        // 6. Go back to "Kontakte" tab and verify the name synced
        await kontakteTabBtn.click({ force: true });
        const agNameInput = agCard.locator('input[type="text"]').first();
        await expect(agNameInput).toBeVisible();
        await expect(agNameInput).toHaveValue('Musterfirma AG');

        // 7. Change the name inside the contact card
        await agNameInput.fill('Musterfirma GmbH');

        // Wait for auto-save toast to settle after typing in contact card
        await expect(toast).toBeVisible({ timeout: 15000 });

        // 8. Switch to "Auftrag und Schadenort" tab and verify it synced back
        await auftragTabBtn.click({ force: true });
        await expect(clientInput).toHaveValue('Musterfirma GmbH');

        // 9. Go back to "Kontakte" tab and verify safety details (no delete button on core contacts)
        await kontakteTabBtn.click({ force: true });
        const agDeleteBtn = agCard.locator('button[title="Löschen"]');
        const eigDeleteBtn = eigCard.locator('button[title="Löschen"]');
        await expect(agDeleteBtn).toHaveCount(0);
        await expect(eigDeleteBtn).toHaveCount(0);

        // 10. Add a new contact card (default is Mieter) and check if it can be deleted
        const addContactBtn = page.locator('button', { hasText: /Kontakt hinzufügen/i }).first();
        await expect(addContactBtn).toBeVisible();
        await addContactBtn.click({ force: true });

        // The third card (index 2) is the first actual Mieter card (since index 0 and 1 are AG and Eig dropdown matching cards)
        const mieterCard = page.locator('div.glass-card', { hasText: 'Mieter' }).nth(2);
        await expect(mieterCard).toBeVisible();
        const mieterDeleteBtn = mieterCard.locator('button[title="Löschen"]');
        await expect(mieterDeleteBtn).toBeVisible();

        // 11. Verify that the role select dropdown for core contacts is NOT disabled
        const agRoleSelect = agCard.locator('select').first();
        await expect(agRoleSelect).not.toBeDisabled();
        
        const eigRoleSelect = eigCard.locator('select').first();
        await expect(eigRoleSelect).not.toBeDisabled();
    });
});
