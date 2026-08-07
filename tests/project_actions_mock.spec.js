import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

test.describe('Project Archive & Soft-Delete Mock Tests', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

        // 1. Login
        await login(page);

        // 2. Insert dummy projects into sessionStorage mock database
        await page.evaluate(() => {
            const mockProjects = [
                {
                    id: 'proj-1-alpha',
                    project_title: 'Projekt Alpha',
                    client: 'Muster AG',
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
                    client: 'Muster AG',
                    status: 'Offen',
                    assigned_to: 'Admin User',
                    date: new Date().toISOString().split('T')[0],
                    address: 'Luzern',
                    report_data: {
                        id: 'proj-2-beta',
                        projectTitle: 'Projekt Beta',
                        client: 'Muster AG',
                        address: 'Luzern',
                        status: 'Offen',
                        rooms: [],
                        measurementRooms: [],
                        images: [],
                        contacts: []
                    }
                },
                {
                    id: 'proj-3-beta-dup',
                    project_title: 'Projekt Beta',
                    client: 'Test AG',
                    status: 'Offen',
                    assigned_to: 'Admin User',
                    date: new Date().toISOString().split('T')[0],
                    address: 'Basel',
                    report_data: {
                        id: 'proj-3-beta-dup',
                        projectTitle: 'Projekt Beta',
                        client: 'Test AG',
                        address: 'Basel',
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
        await expect(page.locator('tr.hover-row', { hasText: 'Projekt Alpha' })).toBeVisible();

        // Click Archive button for proj-1-alpha
        const row = page.locator('tr.hover-row', { hasText: 'Projekt Alpha' });
        const archiveBtn = row.locator('button[title*="archivieren"]');
        await archiveBtn.click();

        // Verify it disappears from "Alle Projekte" list
        await expect(page.locator('tr.hover-row', { hasText: 'Projekt Alpha' })).not.toBeVisible({ timeout: 5000 });

        // Switch to Archiv tab
        const archiveToggle = page.getByRole('button', { name: 'Archiv', exact: true });
        await archiveToggle.click();

        // Verify it is visible in Archiv list
        await expect(page.locator('.table-container tr', { hasText: 'Projekt Alpha' })).toBeVisible();
    });

    test('2. Löschen abbrechen verändert nichts', async ({ page }) => {
        // Setup prompt dialog listener to cancel
        page.once('dialog', dialog => {
            expect(dialog.message()).toContain('wirklich löschen');
            dialog.dismiss();
        });

        // Click Delete button for proj-1-alpha
        const row = page.locator('tr.hover-row', { hasText: 'Projekt Alpha' });
        const deleteBtn = row.locator('button[title*="löschen"]');
        await deleteBtn.click();

        // Verify it remains visible in the list
        await expect(page.locator('tr.hover-row', { hasText: 'Projekt Alpha' })).toBeVisible();
    });

    test('3. Löschen ohne richtiges Kennwort (LÖSCHEN) verändert nichts', async ({ page }) => {
        // Setup prompt dialog listener to input wrong text
        page.once('dialog', dialog => {
            expect(dialog.message()).toContain('wirklich löschen');
            dialog.accept('NEIN');
        });

        // Click Delete button for proj-1-alpha
        const row = page.locator('tr.hover-row', { hasText: 'Projekt Alpha' });
        const deleteBtn = row.locator('button[title*="löschen"]');
        await deleteBtn.click();

        // Verify it remains visible in the list
        await expect(page.locator('tr.hover-row', { hasText: 'Projekt Alpha' })).toBeVisible();
    });

    test('4. Löschen mit LÖSCHEN setzt Soft-Delete', async ({ page }) => {
        // Setup prompt dialog listener to input LÖSCHEN
        page.once('dialog', dialog => {
            expect(dialog.message()).toContain('wirklich löschen');
            dialog.accept('LÖSCHEN');
        });

        // Click Delete button for proj-1-alpha
        const row = page.locator('tr.hover-row', { hasText: 'Projekt Alpha' });
        const deleteBtn = row.locator('button[title*="löschen"]');
        await deleteBtn.click();

        // Verify it disappears from the list
        await expect(page.locator('tr.hover-row', { hasText: 'Projekt Alpha' })).not.toBeVisible({ timeout: 5000 });
    });

    test('5. Lösch-Button ist für Nicht-Admins unsichtbar', async ({ page }) => {
        // Logout and log in as normal technician (Techniker 1)
        await page.locator('button[title="Abmelden"]').click();
        await page.locator('input[type="text"]').fill('Techniker 1');
        await page.locator('input[type="password"]').fill('123');
        await page.locator('button[type="submit"]').click();
        await page.waitForSelector('header.app-header');

        // Verify we are on dashboard
        await expect(page.locator('tr.hover-row', { hasText: 'Projekt Alpha' })).toBeVisible();

        // Check that Delete button is NOT present in the row
        const row = page.locator('tr.hover-row', { hasText: 'Projekt Alpha' });
        const deleteBtn = row.locator('button[title*="löschen"]');
        await expect(deleteBtn).not.toBeVisible();
    });
});
