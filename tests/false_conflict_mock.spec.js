import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

test.describe('False Conflict Prevention (Local Mocks)', () => {

    test.beforeEach(async ({ page }) => {
        await login(page);

        // Inject custom lightweight mock project into sessionStorage
        await page.evaluate(() => {
            const mockProjects = [
                {
                    id: 'proj-lightweight',
                    project_title: 'Projekt Hydration Test',
                    client: 'Muster AG',
                    address: 'Bahnhofstrasse 1, Zürich',
                    status: 'Offen',
                    assigned_to: 'Admin User',
                    date: new Date().toISOString().split('T')[0],
                    isLightweight: true, // Mark as lightweight initially
                    report_data: {
                        id: 'proj-lightweight',
                        projectTitle: 'Projekt Hydration Test',
                        client: 'Muster AG',
                        status: 'Offen',
                        // lightweight means these arrays are empty initially
                        rooms: [],
                        measurementRooms: [],
                        images: [],
                        contacts: []
                    }
                }
            ];
            sessionStorage.setItem('mock_db_projects', JSON.stringify(mockProjects));
        });

        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('header.app-header');
    });

    test('1. Projekt öffnen lädt Full-Report ohne Fehlkonflikt', async ({ page }) => {
        // Open the lightweight project by clicking on it
        const row = page.locator('tr', { hasText: 'Projekt Hydration Test' });
        await row.click();

        // Wait for details view to mount and background load to execute
        await page.waitForSelector('text=Kontakte');
        await page.waitForTimeout(1000);

        // Check unsaved reports in localStorage
        const unsaved = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qservice_unsaved_reports') || '{}');
        });

        // There should be no entry created for this hydration process!
        expect(Object.keys(unsaved).length).toBe(0);

        // Go back to dashboard and verify no local changes dialog is visible
        await page.click('button:has-text("Dashboard"), button:has-text("Zurück")');
        await expect(page.locator('text=Lokale Änderungen gefunden')).not.toBeVisible();
    });

    test('2. Unvollständiges Force-Save blockiert', async ({ page }) => {
        // Inject an invalid or lightweight entry into unsaved reports cache
        await page.evaluate(() => {
            const invalidEntry = {
                'proj-lightweight': {
                    reportId: 'proj-lightweight',
                    projectId: 'proj-lightweight',
                    source: 'hydration', // invalid source
                    isCompleteSnapshot: false, // incomplete snapshot
                    changedPaths: ['rooms'],
                    reportData: {
                        id: 'proj-lightweight',
                        isLightweight: true // lightweight
                    },
                    _sync_conflict: true,
                    projectTitle: 'Projekt Hydration Test'
                }
            };
            localStorage.setItem('qservice_unsaved_reports', JSON.stringify(invalidEntry));
        });

        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('header.app-header');

        // Verify the conflict dialog is displayed
        await expect(page.getByRole('heading', { name: 'Lokale Änderungen gefunden!' })).toBeVisible();

        // The "Lokalen Stand erzwingen" button should be disabled
        const forceBtn = page.locator('button:has-text("Lokalen Stand erzwingen")');
        await expect(forceBtn).toBeDisabled();
    });

    test('3. Echte Offline-Änderung bleibt erhalten', async ({ page }) => {
        // Inject a valid offline entry with source 'offline-edit' and complete snapshot
        await page.evaluate(() => {
            const validEntry = {
                'proj-lightweight': {
                    reportId: 'proj-lightweight',
                    projectId: 'proj-lightweight',
                    source: 'offline-edit',
                    isCompleteSnapshot: true,
                    reportData: {
                        id: 'proj-lightweight',
                        projectTitle: 'Projekt Hydration Test',
                        isLightweight: false,
                        rooms: [{ id: 'room-1', name: 'Wohnzimmer' }]
                    },
                    _sync_conflict: true,
                    projectTitle: 'Projekt Hydration Test'
                }
            };
            localStorage.setItem('qservice_unsaved_reports', JSON.stringify(validEntry));
        });

        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('header.app-header');

        // The conflict dialog should show up
        await expect(page.getByRole('heading', { name: 'Lokale Änderungen gefunden!' })).toBeVisible();

        // The button should be enabled because it's a valid offline edit complete snapshot
        const forceBtn = page.locator('button:has-text("Lokalen Stand erzwingen")');
        await expect(forceBtn).toBeEnabled();
    });

    test('4. Legacy-Lightweight-Eintrag ohne source und ohne echte Änderungen wird bereinigt', async ({ page }) => {
        // Inject a legacy lightweight entry (no source, empty/default data, isLightweight)
        await page.evaluate(() => {
            const legacyEntry = {
                'proj-lightweight': {
                    reportId: 'proj-lightweight',
                    // no source, no isCompleteSnapshot
                    reportData: {
                        id: 'proj-lightweight',
                        projectTitle: 'Projekt Hydration Test',
                        isLightweight: true,
                        rooms: [],
                        measurementRooms: [],
                        images: [],
                        contacts: []
                    },
                    _sync_conflict: true,
                    projectTitle: 'Projekt Hydration Test'
                }
            };
            localStorage.setItem('qservice_unsaved_reports', JSON.stringify(legacyEntry));
        });

        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('header.app-header');

        // Verify the conflict dialog is NOT visible because it was cleaned up on mount
        await expect(page.getByRole('heading', { name: 'Lokale Änderungen gefunden!' })).not.toBeVisible();

        // Verify the false hydration entry has been automatically removed
        const unsaved = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qservice_unsaved_reports') || '{}');
        });
        expect(unsaved['proj-lightweight']).toBeUndefined();
    });

    test('5. Legacy-Eintrag mit echten semantischen Änderungen bleibt erhalten aber blockiert Erzwingen', async ({ page }) => {
        // Inject legacy entry with semantic changes (e.g. customized room) but no verified complete snapshot
        await page.evaluate(() => {
            const legacySemanticEntry = {
                'proj-lightweight': {
                    reportId: 'proj-lightweight',
                    // no source, no isCompleteSnapshot
                    changedPaths: ['rooms'],
                    reportData: {
                        id: 'proj-lightweight',
                        projectTitle: 'Projekt Hydration Test',
                        isLightweight: false,
                        rooms: [{ id: 'room-1', name: 'Custom Room Name Added Offline' }]
                    },
                    _sync_conflict: true,
                    projectTitle: 'Projekt Hydration Test'
                }
            };
            localStorage.setItem('qservice_unsaved_reports', JSON.stringify(legacySemanticEntry));
        });

        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('header.app-header');

        // The conflict dialog should be visible to preserve the legacy local backup
        await expect(page.getByRole('heading', { name: 'Lokale Änderungen gefunden!' })).toBeVisible();

        // But forcing is blocked because isCompleteSnapshot is not true / no valid source
        const forceBtn = page.locator('button:has-text("Lokalen Stand erzwingen")');
        await expect(forceBtn).toBeDisabled();
    });

});
