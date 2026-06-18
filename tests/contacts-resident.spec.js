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

        // 1. Go to "Kontakte" tab
        const kontakteTabBtn = page.locator('button', { hasText: 'Kontakte' }).first();
        await expect(kontakteTabBtn).toBeVisible();
        await kontakteTabBtn.click();

        // 2. Verify Auftraggeber and Eigentümer cards are rendered
        const agCard = page.locator('div.glass-card', { hasText: /Auftraggeber/ }).first();
        const eigCard = page.locator('div.glass-card', { hasText: /Eigentümer/ }).first();
        await expect(agCard).toBeVisible();
        await expect(eigCard).toBeVisible();

        // 3. Verify that the resident checkbox inside Auftraggeber card is unchecked by default
        const agResidentCheckbox = agCard.locator('input[type="checkbox"]');
        await expect(agResidentCheckbox).not.toBeChecked();

        // 4. Toggle the resident status inside the Auftraggeber card
        await agResidentCheckbox.check();
        await expect(agResidentCheckbox).toBeChecked();

        // 5. Switch back to "Auftrag und Schadenort" tab
        const auftragTabBtn = page.locator('button', { hasText: 'Auftrag und Schadenort' }).first();
        await expect(auftragTabBtn).toBeVisible();
        await auftragTabBtn.click();

        // 6. Verify that the global "Auftraggeber ist gleichzeitig Bewohner" checkbox is now checked
        const globalAgResidentInput = page.locator('input[type="checkbox"]').first(); // first checkbox is ClientIsResident
        await expect(globalAgResidentInput).toBeChecked();

        // 7. Change the Auftraggeber Name in the main "Auftrag" form
        const clientInput = page.locator('input[placeholder*="Name oder Firma des Auftraggebers"]').first();
        await expect(clientInput).toBeVisible();
        await clientInput.fill('Musterfirma AG');

        // 8. Go back to "Kontakte" tab and verify the name synced
        await kontakteTabBtn.click();
        const agNameInput = agCard.locator('input[type="text"]').first();
        await expect(agNameInput).toBeVisible();
        await expect(agNameInput).toHaveValue('Musterfirma AG');

        // 9. Change the name inside the contact card
        await agNameInput.fill('Musterfirma GmbH');

        // 10. Switch to "Auftrag und Schadenort" tab and verify it synced back
        await auftragTabBtn.click();
        await expect(clientInput).toHaveValue('Musterfirma GmbH');

        // 11. Go back to "Kontakte" tab and verify safety details (no delete button on core contacts)
        await kontakteTabBtn.click();
        const agDeleteBtn = agCard.locator('button[title="Löschen"]');
        const eigDeleteBtn = eigCard.locator('button[title="Löschen"]');
        await expect(agDeleteBtn).toHaveCount(0);
        await expect(eigDeleteBtn).toHaveCount(0);

        // 12. Add a new contact card (default is Mieter) and check if it can be deleted
        const addContactBtn = page.locator('button', { hasText: /Kontakt hinzufügen/i }).first();
        await addContactBtn.click();

        const mieterCard = page.locator('div.glass-card', { hasText: /Mieter/ }).first();
        await expect(mieterCard).toBeVisible();
        const mieterDeleteBtn = mieterCard.locator('button[title="Löschen"]');
        await expect(mieterDeleteBtn).toBeVisible();

        // 13. Verify that the role select dropdown for core contacts is NOT disabled
        const agRoleSelect = agCard.locator('select').first();
        await expect(agRoleSelect).not.toBeDisabled();
        
        const eigRoleSelect = eigCard.locator('select').first();
        await expect(eigRoleSelect).not.toBeDisabled();
    });
});
