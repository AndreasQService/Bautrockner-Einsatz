import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

async function openNewReport(page) {
    const newOrderBtn = page.locator('button.btn-primary', { hasText: /auftrag/i });
    await expect(newOrderBtn).toBeVisible({ timeout: 5000 });
    await newOrderBtn.click({ force: true });
    
    const navBackBtn = page.locator('header nav button.btn-outline').first();
    await expect(navBackBtn).toBeVisible({ timeout: 10000 });
}

test.describe('Room Inline Editing', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should allow adding, editing, saving, and verifying a room inline', async ({ page }) => {
        await openNewReport(page);

        // Fill client name on the first tab to trigger the initial save and ID generation.
        // This avoids the tab reset race condition when the component remounts due to key changes.
        const clientInput = page.locator('input[placeholder*="Name oder Firma des Auftraggebers"]').first();
        await expect(clientInput).toBeVisible();
        await clientInput.fill('Musterprojekt AG');

        const toast = page.locator('text=Projekt erfolgreich gespeichert!');
        await expect(toast).toBeVisible({ timeout: 15000 });

        // 1. Go to "Räume und Schadensberichte" tab
        const raeumeTabBtn = page.locator('button', { hasText: 'Räume und Schadensberichte' }).first();
        await expect(raeumeTabBtn).toBeVisible();
        await raeumeTabBtn.click({ force: true });

        // 2. Add a new room
        const addRoomBtn = page.locator('button:has-text("Raum hinzufügen")').first();
        await expect(addRoomBtn).toBeVisible();
        await addRoomBtn.click();

        // Select "Sonstiges" (Neue Wohnung) to show the free text input field
        const aptSelect = page.locator('select').filter({ has: page.locator('option[value="Sonstiges"]') }).first();
        await expect(aptSelect).toBeVisible();
        await aptSelect.selectOption('Sonstiges');

        // Fill custom apartment name
        const aptInput = page.locator('input[placeholder="Wohnung eingeben"]').filter({ visible: true }).first();
        await expect(aptInput).toBeVisible();
        await aptInput.fill('Links');

        // Fill Stockwerk afterward
        const stockwerkInput = page.locator('input[placeholder="Stockwerk"]').filter({ visible: true }).first();
        await expect(stockwerkInput).toBeVisible();
        await stockwerkInput.fill('1. OG');

        // Select room option
        const selectRoom = page.locator('select').filter({ hasText: /Raum wählen/i }).filter({ visible: true }).first();
        await expect(selectRoom).toBeVisible();
        await selectRoom.selectOption('Wohnzimmer');

        // Click Save to add the room
        const saveAddRoomBtn = page.locator('button:has-text("Speichern")').filter({ visible: true }).first();
        await expect(saveAddRoomBtn).toBeVisible();
        await saveAddRoomBtn.click();

        // Verify that the room has been added
        const roomCardHeader = page.locator('div.card').first();
        await expect(roomCardHeader).toBeVisible();
        await expect(roomCardHeader.getByText('Wohnzimmer')).toBeVisible();
        await expect(roomCardHeader.getByText(/1\. OG/)).toBeVisible();
        await expect(roomCardHeader.getByText(/Links/)).toBeVisible();

        // 3. Click "Bearbeiten" (pen icon button)
        const editBtn = page.locator('button[title="Raum bearbeiten"]').filter({ visible: true }).first();
        await expect(editBtn).toBeVisible();
        await editBtn.scrollIntoViewIfNeeded();
        await editBtn.click();

        // 4. Verify editing inputs are populated and modify them
        const editNameInput = page.locator('input[placeholder="Raum Name"]').filter({ visible: true }).first();
        await expect(editNameInput).toBeVisible();
        await expect(editNameInput).toHaveValue('Wohnzimmer');
        await editNameInput.fill('Wohnbereich');

        const editStockInput = page.locator('input[placeholder="Stockwerk"]').filter({ visible: true }).first();
        await expect(editStockInput).toBeVisible();
        await expect(editStockInput).toHaveValue('1. OG');
        await editStockInput.fill('EG');

        const editAptInput = page.locator('input[placeholder="Wohnung"]').filter({ visible: true }).first();
        await expect(editAptInput).toBeVisible();
        await expect(editAptInput).toHaveValue('Links');
        await editAptInput.fill('Rechts');

        // 5. Click Save (check icon button)
        const saveEditBtn = page.locator('button[title="Speichern"]').filter({ visible: true }).first();
        await expect(saveEditBtn).toBeVisible();
        await saveEditBtn.scrollIntoViewIfNeeded();
        await saveEditBtn.click();

        // 6. Verify that the updated room header details are displayed
        await expect(page.locator('input[placeholder="Raum Name"]').filter({ visible: true })).toHaveCount(0); // input is gone
        await expect(roomCardHeader.getByText('Wohnbereich')).toBeVisible();
        await expect(roomCardHeader.getByText(/EG/)).toBeVisible();
        await expect(roomCardHeader.getByText(/Rechts/)).toBeVisible();
    });
});
