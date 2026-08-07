import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

test.describe('Project Archive and Delete Actions (Local Mocks)', () => {

    test.beforeEach(async ({ page }) => {
        // 1. Initial login to get to the domain
        await login(page);

        // 2. Inject custom mock projects into sessionStorage
        await page.evaluate(() => {
            const mockProjects = [
                {
                    id: 'proj-1-alpha',
                    project_title: 'Projekt Alpha',
                    client: 'Muster AG',
                    address: 'Bahnhofstrasse 1, Zürich',
                    status: 'Offen',
                    assigned_to: 'Admin User',
                    date: new Date().toISOString().split('T')[0],
                    report_data: {
                        id: 'proj-1-alpha',
                        projectTitle: 'Projekt Alpha',
                        client: 'Muster AG',
                        status: 'Offen',
                        rooms: [],
                        measurementRooms: [],
                        images: [],
                        contacts: []
                    }
                },
                {
                    id: 'proj-2-beta',
                    project_title: 'Projekt Beta',
                    client: 'Muster GmbH',
                    address: 'Zentralstrasse 5, Luzern',
                    status: 'Offen',
                    assigned_to: 'Admin User',
                    date: new Date().toISOString().split('T')[0],
                    report_data: {
                        id: 'proj-2-beta',
                        projectTitle: 'Projekt Beta',
                        client: 'Muster GmbH',
                        status: 'Offen',
                        rooms: [],
                        measurementRooms: [],
                        images: [],
                        contacts: []
                    }
                },
                {
                    id: 'proj-3-beta-dup',
                    project_title: 'Projekt Beta', // Duplicate name!
                    client: 'Test AG',
                    address: 'Grenzstrasse 10, Basel',
                    status: 'Offen',
                    assigned_to: 'Admin User',
                    date: new Date().toISOString().split('T')[0],
                    report_data: {
                        id: 'proj-3-beta-dup',
                        projectTitle: 'Projekt Beta',
                        client: 'Test AG',
                        status: 'Offen',
                        rooms: [],
                        measurementRooms: [],
                        images: [],
                        contacts: []
                    }
                }
            ];
            sessionStorage.setItem('mock_db_projects', JSON.stringify(mockProjects));
        });

        // 3. Reload page to apply mock projects
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('header.app-header');
    });

    test('1. Archivieren eines Projekts verschiebt es ins Archiv', async ({ page }) => {
        // Setup confirm dialog listener to auto-accept
        page.once('dialog', dialog => {
            expect(dialog.message()).toContain('wirklich archivieren');
            dialog.accept();
        });

        // Verify "Projekt Alpha" is present in All Projects list
        await expect(page.getByText('Projekt Alpha')).toBeVisible();

        // Click Archive button for proj-1-alpha
        // Find row with Projekt Alpha and click the Archive button inside it
        const row = page.locator('tr', { hasText: 'Projekt Alpha' });
        const archiveBtn = row.locator('button[title*="archivieren"]');
        await archiveBtn.click();

        // Verify it disappears from "Alle Projekte" list
        await expect(page.getByText('Projekt Alpha')).not.toBeVisible({ timeout: 5000 });

        // Switch to Archiv tab
        const archiveToggle = page.getByRole('button', { name: 'Archiv', exact: true });
        await archiveToggle.click();

        // Verify it is visible in Archiv list
        await expect(page.getByText('Projekt Alpha')).toBeVisible();
    });

    test('2. Löschen abbrechen verändert nichts', async ({ page }) => {
        // Setup confirm dialog listener to cancel
        page.once('dialog', dialog => {
            expect(dialog.message()).toContain('wirklich löschen');
            dialog.dismiss();
        });

        // Click Delete button for proj-1-alpha
        const row = page.locator('tr', { hasText: 'Projekt Alpha' });
        const deleteBtn = row.locator('button[title*="löschen"]');
        await deleteBtn.click();

        // Verify it remains visible in the list
        await expect(page.getByText('Projekt Alpha')).toBeVisible();
    });

    test('3. Löschen bestätigen setzt Soft-Delete', async ({ page }) => {
        // Setup confirm dialog listener to accept
        page.once('dialog', dialog => {
            expect(dialog.message()).toContain('wirklich löschen');
            dialog.accept();
        });

        // Click Delete button for proj-1-alpha
        const row = page.locator('tr', { hasText: 'Projekt Alpha' });
        const deleteBtn = row.locator('button[title*="löschen"]');
        await deleteBtn.click();

        // Verify it disappears from the list
        await expect(page.getByText('Projekt Alpha')).not.toBeVisible({ timeout: 5000 });
    });

    test('4. Gleichnamiges Projekt bleibt unverändert', async ({ page }) => {
        // Setup confirm dialog listener to accept archiving for project-2-beta but NOT project-3-beta-dup
        page.once('dialog', dialog => {
            expect(dialog.message()).toContain('wirklich archivieren');
            dialog.accept();
        });

        // Click Archive button for proj-2-beta (Luzern)
        const rowBeta1 = page.locator('tr', { hasText: 'Luzern' });
        const archiveBtn = rowBeta1.locator('button[title*="archivieren"]');
        await archiveBtn.click();

        // Verify proj-2-beta (Luzern) is gone
        await expect(page.getByText('Luzern')).not.toBeVisible({ timeout: 5000 });

        // Verify duplicate project (Basel) is still visible and unaffected
        await expect(page.getByText('Basel')).toBeVisible();
    });

    test('5. Speicherfehler führt zu Rollback und zeigt Fehlermeldung', async ({ page }) => {
        // Stub supabase update to fail
        await page.evaluate(() => {
            if (window.supabase) {
                const originalFrom = window.supabase.from;
                window.supabase.from = function(tableName) {
                    if (tableName === 'damage_reports') {
                        return {
                            select: () => ({
                                eq: () => ({
                                    single: () => Promise.resolve({
                                        data: {
                                            report_data: {
                                                id: 'proj-1-alpha',
                                                projectTitle: 'Projekt Alpha',
                                                client: 'Muster AG',
                                                status: 'Offen',
                                                rooms: [],
                                                measurementRooms: [],
                                                images: [],
                                                contacts: []
                                            }
                                        },
                                        error: null
                                    })
                                })
                            }),
                            update: () => ({
                                eq: () => Promise.resolve({
                                    data: null,
                                    error: { message: 'SIMULATED DATABASE ERROR' }
                                })
                            })
                        };
                    }
                    return originalFrom.apply(window.supabase, arguments);
                };
            }
        });

        // Setup confirm dialog listener to accept
        page.once('dialog', dialog => {
            dialog.accept();
        });

        // Capture window.alert to confirm error message is shown
        let alertMsg = '';
        page.on('dialog', dialog => {
            if (dialog.type() === 'alert') {
                alertMsg = dialog.message();
                dialog.accept();
            }
        });

        // Click Archive button for proj-1-alpha
        const row = page.locator('tr', { hasText: 'Projekt Alpha' });
        const archiveBtn = row.locator('button[title*="archivieren"]');
        await archiveBtn.click();

        // Verify the alert error is visible
        await page.waitForTimeout(500);
        expect(alertMsg).toContain('SIMULATED DATABASE ERROR');

        // Verify it remains visible in the list (rollback succeeded)
        await expect(page.getByText('Projekt Alpha')).toBeVisible();
    });

});
