import { test, expect } from '@playwright/test';

test.describe('Compulsory Live Test: Archive & Soft-Delete', () => {
    // Override the default baseURL for this test to the production URL
    test.use({ baseURL: 'https://bautrockner-einsatz.vercel.app' });

    test('Archive and Soft-Delete Live Verification', async ({ page, context }) => {
        const uniqueNumber = `LIVE-TEST-${Date.now()}`;
        console.log(`Using test project number: ${uniqueNumber}`);

        // 1. Log in to production website
        await page.goto('/');
        await page.locator('input[type="text"]').fill('Admin User');
        await page.locator('input[type="password"]').fill('admin');
        await page.getByRole('button', { name: /anmelden/i }).click();
        await page.waitForSelector('header.app-header', { timeout: 15000 });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // 2. Create a clearly designated test project via the UI
        const newOrderBtn = page.locator('button:has-text("Neuer Auftrag"), button:has-text("New Order")');
        await expect(newOrderBtn).toBeVisible({ timeout: 10000 });
        await newOrderBtn.click();
        
        // Wait for the form inputs to appear
        await page.waitForSelector('input[placeholder="Projekt-Nr."]', { timeout: 10000 });
        await page.locator('input[placeholder="Projekt-Nr."]').fill(uniqueNumber);
        await page.locator('input[placeholder="Strasse & Nr."]').first().fill('Testweg 99');
        await page.locator('input[placeholder="PLZ"]').first().fill('8000');
        await page.locator('input[placeholder="Ort"]').first().fill('Zürich');
        await page.locator('input[placeholder="Name oder Firma des Auftraggebers"]').fill('Live Test GmbH');
        
        // Wait 3 seconds to ensure the 2-second autosave debounce is triggered and processed
        await page.waitForTimeout(3500);
        // Wait for auto-save to complete and show "Gespeichert"
        await expect(page.locator('text=Gespeichert')).toBeVisible({ timeout: 15000 });
        
        // Click Fertig to save and exit to dashboard
        await page.locator('button:has-text("Fertig")').click();
        await page.waitForSelector('header.app-header', { timeout: 10000 });

        // Ensure we are back on Dashboard and "Alle Fälle" is checked
        const allCasesCheckbox = page.locator('input[type="checkbox"]').nth(1); // the showAllCases checkbox
        if (await allCasesCheckbox.isVisible() && !(await allCasesCheckbox.isChecked())) {
            await allCasesCheckbox.check();
        }

        // Wait for list to load and verify test project is visible
        const sidebarRow = page.locator('tr.hover-row', { hasText: uniqueNumber });
        await expect(sidebarRow).toBeVisible({ timeout: 15000 });

        // 3. Archivieren: click Archive button on that project row
        page.on('dialog', async dialog => {
            if (dialog.message().includes(uniqueNumber)) {
                await dialog.accept();
            }
        });
        const archiveBtn = sidebarRow.locator('button[title*="archivieren"]');
        await archiveBtn.click();

        // Verify it disappears from "Alle Projekte"
        await expect(sidebarRow).not.toBeVisible({ timeout: 10000 });

        // Close the current browser context (private tab) to clear all state
        await context.close();

        // 4. Open a completely new private browser context
        const newContext = await context.browser().newContext({
            viewport: { width: 1280, height: 800 },
            permissions: ['microphone', 'camera'],
            locale: 'de-DE'
        });
        const newPage = await newContext.newPage();

        // Log in again in the new context
        await newPage.goto('https://bautrockner-einsatz.vercel.app');
        await newPage.locator('input[type="text"]').fill('Admin User');
        await newPage.locator('input[type="password"]').fill('admin');
        await newPage.getByRole('button', { name: /anmelden/i }).click();
        await newPage.waitForSelector('header.app-header', { timeout: 15000 });
        await newPage.waitForLoadState('networkidle');
        await newPage.waitForTimeout(1500);

        // Ensure "Alle Fälle" is checked
        const allCasesCheckbox2 = newPage.locator('input[type="checkbox"]').nth(1);
        if (await allCasesCheckbox2.isVisible() && !(await allCasesCheckbox2.isChecked())) {
            await allCasesCheckbox2.check();
        }

        // Confirm: Project is missing under "Alle Projekte" (dashboard sidebar list)
        const sidebarRow2 = newPage.locator('tr.hover-row', { hasText: uniqueNumber });
        await expect(sidebarRow2).not.toBeVisible({ timeout: 5000 });

        // Switch to Archiv tab
        const archiveToggle = newPage.getByRole('button', { name: 'Archiv', exact: true });
        await archiveToggle.click();

        // Confirm: Project is in Archiv list
        const archiveRow = newPage.locator('.table-container tr', { hasText: uniqueNumber });
        await expect(archiveRow).toBeVisible({ timeout: 10000 });

        // Confirm: Project opens successfully
        await archiveRow.click();
        await expect(newPage.locator('text=Projektdaten')).toBeVisible({ timeout: 10000 });

        // Go back to Dashboard
        await newPage.locator('button[title="Dashboard"]').click().catch(async () => {
            await newPage.locator('button:has-text("Dashboard")').click();
        });
        await newPage.waitForSelector('header.app-header', { timeout: 10000 });

        // Switch to Archiv tab again
        await newPage.getByRole('button', { name: 'Archiv', exact: true }).click();
        const archiveRow2 = newPage.locator('.table-container tr', { hasText: uniqueNumber });

        // 5. Delete project via soft-delete in Archiv tab
        // Let's set up the prompt mock to enter "LÖSCHEN"
        newPage.on('dialog', async dialog => {
            if (dialog.type() === 'prompt') {
                await dialog.accept('LÖSCHEN');
            } else if (dialog.type() === 'confirm') {
                await dialog.accept();
            }
        });
        
        const deleteBtn = archiveRow2.locator('button[title*="löschen"]');
        await deleteBtn.click();

        // Verify it disappears from Archive list
        await expect(archiveRow2).not.toBeVisible({ timeout: 10000 });

        // 6. Close the browser context completely
        await newContext.close();

        // 7. Open a second new private browser context and log in
        const secondContext = await context.browser().newContext({
            viewport: { width: 1280, height: 800 },
            permissions: ['microphone', 'camera'],
            locale: 'de-DE'
        });
        const secondPage = await secondContext.newPage();
        await secondPage.goto('https://bautrockner-einsatz.vercel.app');
        await secondPage.locator('input[type="text"]').fill('Admin User');
        await secondPage.locator('input[type="password"]').fill('admin');
        await secondPage.getByRole('button', { name: /anmelden/i }).click();
        await secondPage.waitForSelector('header.app-header', { timeout: 15000 });
        await secondPage.waitForLoadState('networkidle');
        await secondPage.waitForTimeout(1500);

        // Ensure "Alle Fälle" is checked
        const allCasesCheckbox3 = secondPage.locator('input[type="checkbox"]').nth(1);
        if (await allCasesCheckbox3.isVisible() && !(await allCasesCheckbox3.isChecked())) {
            await allCasesCheckbox3.check();
        }

        // Confirm: Project is missing under "Alle Projekte" (dashboard sidebar list)
        const sidebarRow3 = secondPage.locator('tr.hover-row', { hasText: uniqueNumber });
        await expect(sidebarRow3).not.toBeVisible({ timeout: 5000 });

        // Switch to Archiv tab
        const archiveToggle3 = secondPage.getByRole('button', { name: 'Archiv', exact: true });
        await archiveToggle3.click();

        // Confirm: Project is missing in Archiv list
        const archiveRow3 = secondPage.locator('.table-container tr', { hasText: uniqueNumber });
        await expect(archiveRow3).not.toBeVisible({ timeout: 5000 });

        // Search for the project - should not be visible anywhere
        const globalSearch = secondPage.locator('input[placeholder*="Suche"]');
        await globalSearch.fill(uniqueNumber);
        await expect(secondPage.locator('tr.hover-row', { hasText: uniqueNumber })).not.toBeVisible({ timeout: 5000 });
        await expect(secondPage.locator('.table-container tr', { hasText: uniqueNumber })).not.toBeVisible({ timeout: 5000 });

        await secondContext.close();
        console.log(`Live verification completed successfully for ${uniqueNumber}!`);
    });
});
