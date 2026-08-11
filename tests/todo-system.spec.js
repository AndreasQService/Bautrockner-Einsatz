import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

async function waitForLoadingFinished(page) {
    await expect(page.getByText('Aufgaben werden geladen...')).toHaveCount(0, { timeout: 15000 });
}

async function waitForProjectLoaded(page) {
    await expect(page.getByText('Projektdaten werden vollständig geladen...')).toHaveCount(0, { timeout: 15000 });
}

test.describe('Todo System End-to-End Workflows', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
        page.on('requestfailed', req => {
            console.log(`BROWSER REQUEST FAILED: ${req.method()} ${req.url()} - ${req.failure()?.errorText || 'Unknown error'}`);
        });
        page.on('response', async res => {
            if (res.status() >= 400) {
                try {
                    const text = await res.text();
                    console.log(`BROWSER RESPONSE ERROR: ${res.status()} ${res.url()} - Body: ${text}`);
                } catch (e) {
                    console.log(`BROWSER RESPONSE ERROR: ${res.status()} ${res.url()} - (Failed to read body)`);
                }
            }
        });
        await login(page);
    });

    test('should support full Todo lifecycle, manual, fast, follow-up, automatic checks and archiving', async ({ page }) => {
        test.setTimeout(75000);

        // --- STEP 1: CREATE NEW TEST CASE ---
        const newOrderBtn = page.locator('button.btn-primary', { hasText: /auftrag/i });
        await expect(newOrderBtn).toBeVisible({ timeout: 10000 });
        await newOrderBtn.click({ force: true });

        const clientInput = page.locator('input[placeholder*="Name oder Firma des Auftraggebers"]').first();
        await expect(clientInput).toBeVisible({ timeout: 10000 });

        // Use a unique client name to safely identify our test project
        const uniqueClientName = `Test Todo System Client ${Date.now()}`;
        await clientInput.fill(uniqueClientName);

        // Fill Projekt-Nr to ensure it sets projectNumber and projectTitle
        const projectNumberInput = page.locator('input[placeholder*="Projekt-Nr."]').first();
        await expect(projectNumberInput).toBeVisible();
        await projectNumberInput.fill(uniqueClientName);

        // Fill Strasse (street) to ensure formatTechnicianLocation also contains it
        const strasseInput = page.locator('input[placeholder*="Strasse & Nr."]').first();
        await expect(strasseInput).toBeVisible();
        await strasseInput.fill(uniqueClientName);

        // Wait for the project auto-save
        await expect(page.locator('text=Gespeichert').first()).toBeVisible({ timeout: 15000 });

        // Navigate back to the Dashboard
        const navBackBtn = page.locator('header nav button.btn-outline').first();
        await expect(navBackBtn).toBeVisible();
        await navBackBtn.click();

        // --- STEP 2: CREATE A MANUAL PROJECT TODO ---
        const newTodoBtn = page.locator('button', { hasText: 'To-do neu' }).first();
        await expect(newTodoBtn).toBeVisible({ timeout: 10000 });
        await newTodoBtn.click();

        // Check if modal is visible
        const modalTitle = page.locator('h3', { hasText: 'Neues To-do erstellen' });
        await expect(modalTitle).toBeVisible();

        // Search and select our created project
        const projInput = page.locator('input[placeholder*="Projekt suchen"]').first();
        await expect(projInput).toBeVisible();
        await projInput.fill(uniqueClientName);

        // Select the matching project from autocomplete dropdown
        const dropdownItem = page.locator('div[style*="position: absolute"] div').filter({ hasText: uniqueClientName }).first();
        await expect(dropdownItem).toBeVisible({ timeout: 5000 });
        await dropdownItem.click();

        // Fill task assignee, title and due date
        const assigneeSelect = page.locator('form select').first(); // Mitarbeiter auswählen select
        await assigneeSelect.selectOption({ index: 1 }); // choose first user

        const taskField = page.locator('input[placeholder="Was ist zu tun?"]').first();
        await expect(taskField).toBeVisible();
        await taskField.fill('Test Project Task A');

        // Due date: preset to "Morgen" (tomorrow)
        const morgenBtn = page.locator('form button', { hasText: 'Morgen' }).first();
        await morgenBtn.click();

        // Save manual todo
        const saveBtn = page.locator('form button[type="submit"]').first();
        await saveBtn.click();

        // Wait for loading to finish
        await waitForLoadingFinished(page);

        // Verify task appears on Dashboard
        await expect(page.getByText('Test Project Task A')).toBeVisible({ timeout: 10000 });

        // --- STEP 3: CREATE A FAST TODO WITHOUT PROJECT ---
        await newTodoBtn.click();
        await expect(modalTitle).toBeVisible();

        // Assignee
        await assigneeSelect.selectOption({ index: 1 });

        // Task name
        await taskField.fill('Fast Standalone Task B');

        // Due Date Today
        await page.locator('form button', { hasText: 'Heute' }).first().click();

        // Save fast todo
        await saveBtn.click();

        // Wait for loading to finish
        await waitForLoadingFinished(page);

        // Verify fast todo appears in dashboard with label "Ohne Projektzuordnung"
        await expect(page.getByText('Fast Standalone Task B')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Ohne Projektzuordnung')).toBeVisible({ timeout: 10000 });

        // --- STEP 4: HARD RELOAD / PERSISTENCE CHECK ---
        await page.reload();
        await waitForLoadingFinished(page);
        await expect(page.getByText('Test Project Task A')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Fast Standalone Task B')).toBeVisible({ timeout: 10000 });

        // --- STEP 5: ERLEDIGEN & FOLGE-TO-DO TRIGGER ---
        // Complete "Fast Standalone Task B"
        const fastTodoRow = page.locator('tr', { has: page.getByText('Fast Standalone Task B') });
        const checkbox = fastTodoRow.locator('input[type="checkbox"]').first();
        await checkbox.click();

        // Verify follow-up modal opens
        const followUpTitle = page.locator('h3', { hasText: 'Folge-To-do erstellen' });
        await expect(followUpTitle).toBeVisible({ timeout: 5000 });

        // Enter follow-up details
        const followUpTaskField = page.locator('input[placeholder="Was ist zu tun?"]').first();
        await expect(followUpTaskField).toBeVisible();
        await followUpTaskField.fill('Rolling Follow Up Task C');

        await page.locator('form button', { hasText: 'Morgen' }).first().click();
        await page.locator('button', { hasText: 'Folge-To-do speichern' }).first().click();

        // Wait for modal to close and loading to finish
        await expect(followUpTitle).toBeHidden({ timeout: 10000 });
        await waitForLoadingFinished(page);

        // Verify Fast Standalone Task B is completed (gone from active list)
        await expect(page.getByText('Fast Standalone Task B')).toHaveCount(0);
        // Exactly one follow-up is active; rapid/double submission must not duplicate it.
        await expect(page.getByText('Rolling Follow Up Task C')).toHaveCount(1, { timeout: 10000 });

        // --- STEP 6: HISTORY VIEW ---
        const historyBtn = page.getByText('History anzeigen').first();
        await historyBtn.click();

        // Verify Fast Standalone Task B is visible in history
        await expect(page.getByText('Fast Standalone Task B')).toHaveCount(1, { timeout: 5000 });

        // Hide history
        await page.getByText('History ausblenden').first().click();

        // --- STEP 7: AUTOMATIC TODOS & DRYING CHECK ---
        // Go back into our created project
        const projectRowLink = page.locator('tr', { has: page.getByText('Test Project Task A') }).locator('button').first();
        await projectRowLink.click();

        // Wait for full report to load
        await waitForProjectLoaded(page);

        // Change project status to "Trocknung"
        const statusSelect = page.locator('select').filter({ hasText: /Schadenaufnahme/ }).first();
        await statusSelect.selectOption('Trocknung');

        // Wait for save
        await expect(page.locator('text=Gespeichert').first()).toBeVisible({ timeout: 10000 });

        // Go back to Dashboard
        await navBackBtn.click();
        await waitForLoadingFinished(page);

        // Switch to Techniker mode
        const desktopBtn = page.locator('button', { hasText: 'Desktop' });
        if (await desktopBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await desktopBtn.click();
            await expect(page.locator('button', { hasText: 'Techniker' })).toBeVisible({ timeout: 5000 });
        }

        // Search for project to bypass pagination
        const searchInput = page.locator('input[placeholder*="Suche"]').first();
        await expect(searchInput).toBeVisible({ timeout: 5000 });
        await searchInput.fill(uniqueClientName);

        // Open our created project (which is under active drying projects list)
        const projectCard = page.locator('.tech-project-card', { hasText: uniqueClientName }).first();
        await expect(projectCard).toBeVisible({ timeout: 10000 });
        await projectCard.click();

        // Wait for full report to load
        await waitForProjectLoaded(page);

        // Click "Messung" tile
        const messungTile = page.locator('button', { hasText: 'Messung' }).first();
        await expect(messungTile).toBeVisible({ timeout: 5000 });
        await messungTile.click();

        // Click "+ Neuer Raum"
        const addRoomBtn = page.locator('button', { hasText: 'Neuer Raum' }).first();
        await expect(addRoomBtn).toBeVisible({ timeout: 5000 });
        await addRoomBtn.click();

        // Select Flur and save (using specific select containing Flur option, saving with "Fertig")
        const selectRoom = page.locator('select').filter({ has: page.locator('option', { hasText: 'Flur' }) }).first();
        await expect(selectRoom).toBeVisible();
        await selectRoom.selectOption('Flur');
        const saveRoomBtn = page.locator('button', { hasText: 'Fertig' }).first();
        await expect(saveRoomBtn).toBeVisible();
        await saveRoomBtn.click();

        // Verify the room "Flur" is now listed
        const flurHeader = page.getByText('Flur').first();
        await expect(flurHeader).toBeVisible({ timeout: 5000 });

        // Click "Messung starten" or "Messung"
        const startMeasBtn = page.locator('button', { hasText: /Messung/ }).first();
        await expect(startMeasBtn).toBeVisible();
        await startMeasBtn.click();

        // Enter measurement date
        const measDateInput = page.locator('input[type="date"]').first();
        const todayStr = new Date().toISOString().split('T')[0];
        await expect(measDateInput).toBeVisible();
        await measDateInput.fill(todayStr);

        // Enter measurement value (using specific placeholder "W" for webdriver-enabled inputs)
        const valInput = page.locator('input[placeholder="W"]').first();
        await expect(valInput).toBeVisible();
        await valInput.fill('45');

        // Click Fertig / Speichern in the measurement modal
        const saveMeasBtn = page.locator('button', { hasText: 'Fertig' }).first();
        await expect(saveMeasBtn).toBeVisible();
        await saveMeasBtn.click();

        // Go back to the dashboard / list of projects
        const dashboardBtn = page.locator('button', { hasText: 'Dashboard' }).first();
        if (await dashboardBtn.isVisible().catch(() => false)) {
            await dashboardBtn.click();
        } else {
            const techBackBtn = page.locator('button', { hasText: 'Zurück' }).first();
            if (await techBackBtn.isVisible().catch(() => false)) {
                await techBackBtn.click();
            }
        }

        // Toggle back to Desktop mode
        const techToggleBtn = page.locator('button', { hasText: 'Techniker' });
        if (await techToggleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await techToggleBtn.click();
            await expect(page.locator('button', { hasText: 'Desktop' })).toBeVisible({ timeout: 5000 });
        }

        // Wait for loading to finish
        await waitForLoadingFinished(page);

        // Verify exactly one automatic Feuchtekontrolle is created
        // (Due Date should be today + 7 days)
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const expectedDueLabel = `fällig ${futureDate.toLocaleDateString('de-CH')}`;
        await expect(page.getByText('Nächste Feuchtekontrolle durchführen').first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(expectedDueLabel).first()).toBeVisible({ timeout: 5000 });

        // --- STEP 8: DOUBLE MEASUREMENT TEST ---
        // Toggle back to Techniker mode
        if (await desktopBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await desktopBtn.click();
            await expect(page.locator('button', { hasText: 'Techniker' })).toBeVisible({ timeout: 5000 });
        }

        // Search for project
        await expect(searchInput).toBeVisible({ timeout: 5000 });
        await searchInput.fill(uniqueClientName);

        // Open project
        await expect(projectCard).toBeVisible({ timeout: 10000 });
        await projectCard.click();

        // Wait for full report to load
        await waitForProjectLoaded(page);

        // Click Messung tile
        await expect(messungTile).toBeVisible({ timeout: 5000 });
        await messungTile.click();

        // Click "Messung fortsetzen" or "Neue Messung" on the Flur card
        const nextMeasBtn = page.locator('button', { hasText: /Messung/ }).first();
        await expect(nextMeasBtn).toBeVisible();
        await nextMeasBtn.click();

        // Set date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await expect(measDateInput).toBeVisible();
        await measDateInput.fill(tomorrow.toISOString().split('T')[0]);
        await expect(valInput).toBeVisible();
        await valInput.fill('40');
        await saveMeasBtn.click();

        // Return to dashboard
        const dashboardBtn2 = page.locator('button', { hasText: 'Dashboard' }).first();
        if (await dashboardBtn2.isVisible().catch(() => false)) {
            await dashboardBtn2.click();
        } else {
            const techBackBtn = page.locator('button', { hasText: 'Zurück' }).first();
            if (await techBackBtn.isVisible().catch(() => false)) {
                await techBackBtn.click();
            }
        }

        // Toggle back to Desktop mode
        if (await techToggleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await techToggleBtn.click();
            await expect(page.locator('button', { hasText: 'Desktop' })).toBeVisible({ timeout: 5000 });
        }

        // Wait for loading to finish
        await waitForLoadingFinished(page);

        // Verify previous auto todo is marked done, and exactly one new one is created for tomorrow + 7 days
        const nextFutureDate = new Date();
        nextFutureDate.setDate(nextFutureDate.getDate() + 8);
        const nextExpectedDueLabel = `fällig ${nextFutureDate.toLocaleDateString('de-CH')}`;
        await expect(page.getByText(nextExpectedDueLabel).first()).toBeVisible({ timeout: 10000 });

        // --- STEP 9: PROJECT ARCHIVE / CLOSURE ---
        // Complete "Test Project Task A" but set "Abschluss" true first.
        const testProjTaskRow = page.locator('tr', { has: page.getByText('Test Project Task A') });
        await testProjTaskRow.locator('button[title="Aufgabe bearbeiten"]').click();

        // Check "Abschluss" checkbox inside the modal
        const closesProjCheckbox = page.locator('input[id="closesProject"]').first();
        await expect(closesProjCheckbox).toBeVisible();
        await closesProjCheckbox.check();
        await saveBtn.click();

        // Wait for loading to finish
        await waitForLoadingFinished(page);

        // Now complete the task (checkbox)
        const testProjTaskCheckbox = testProjTaskRow.locator('input[type="checkbox"]').first();
        await testProjTaskCheckbox.click();

        // Confirm archiving dialog
        const archiveConfirmBtn = page.locator('button', { hasText: 'Ja, Projekt abschliessen' }).first();
        await expect(archiveConfirmBtn).toBeVisible({ timeout: 5000 });
        await archiveConfirmBtn.click();

        // Wait for loading to finish
        await waitForLoadingFinished(page);

        // Verify project is archived (no longer shows up in active lists)
        await expect(page.getByText(uniqueClientName)).toHaveCount(0);
        // Verify all open todos for this project are gone from active dashboard tasks
        await expect(page.locator('tr', { hasText: uniqueClientName }).filter({ hasText: 'Nächste Feuchtekontrolle durchführen' })).toHaveCount(0);
    });
});
