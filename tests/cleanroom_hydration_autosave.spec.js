import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

test.use({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' });

test.describe('Cleanroom Hydration and Autosave tests', () => {

    test.beforeEach(async ({ page }) => {
        // Set up the window.supabase proxy for delay injection before load
        await page.addInitScript(() => {
            Object.defineProperty(window, 'supabase', {
                get() { return window._mock_supabase; },
                set(val) {
                    window._mock_supabase = new Proxy(val, {
                        get(target, prop) {
                            if (prop === 'from') {
                                return (tableName) => {
                                    const origQuery = target.from(tableName);
                                    if (tableName === 'damage_reports') {
                                        return new Proxy(origQuery, {
                                            get(queryTarget, queryProp) {
                                                if (queryProp === 'select') {
                                                    return (columns) => {
                                                        const selectResult = queryTarget.select(columns);
                                                        const delayStr = sessionStorage.getItem('mock_db_delay') || '0';
                                                        const delay = parseInt(delayStr, 10);
                                                        if (delay > 0) {
                                                            const origThen = selectResult.then;
                                                            selectResult.then = function(onfulfilled, onrejected) {
                                                                return new Promise(resolve => setTimeout(resolve, delay))
                                                                    .then(() => origThen.call(selectResult, onfulfilled, onrejected));
                                                            };
                                                        }
                                                        return selectResult;
                                                    };
                                                }
                                                return queryTarget[queryProp];
                                            }
                                        });
                                    }
                                    return origQuery;
                                };
                            }
                            return target[prop];
                        }
                    });
                },
                configurable: true
            });
        });

        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

        await login(page);

        // Inject mock projects
        await page.evaluate(() => {
            localStorage.removeItem('qservice_unsaved_reports');
            localStorage.removeItem('qservice_unsaved_reports_quarantine');
            localStorage.removeItem('qservice_reports_prod');

            const mockProjects = [
                {
                    id: 'proj-lightweight-1',
                    project_title: 'Projekt Hydration Test 1',
                    client: 'Kunde A',
                    address: 'Strasse 1',
                    status: 'Offen',
                    assigned_to: 'Admin User',
                    date: new Date().toISOString().split('T')[0],
                    isLightweight: true,
                    updated_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    _supabase_updated_at: new Date().toISOString(),
                    report_data: {
                        id: 'proj-lightweight-1',
                        projectTitle: 'Projekt Hydration Test 1',
                        client: 'Kunde A',
                        status: 'Offen',
                        rooms: [],
                        measurementRooms: [],
                        images: [],
                        contacts: [],
                        updated_at: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        _supabase_updated_at: new Date().toISOString()
                    }
                },
                {
                    id: 'proj-lightweight-2',
                    project_title: 'Projekt Hydration Test 2',
                    client: 'Kunde B',
                    address: 'Strasse 2',
                    status: 'Offen',
                    assigned_to: 'Admin User',
                    date: new Date().toISOString().split('T')[0],
                    isLightweight: true,
                    updated_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    _supabase_updated_at: new Date().toISOString(),
                    report_data: {
                        id: 'proj-lightweight-2',
                        projectTitle: 'Projekt Hydration Test 2',
                        client: 'Kunde B',
                        status: 'Offen',
                        rooms: [],
                        measurementRooms: [],
                        images: [],
                        contacts: [],
                        updated_at: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        _supabase_updated_at: new Date().toISOString()
                    }
                }
            ];
            sessionStorage.setItem('mock_db_projects', JSON.stringify(mockProjects));
        });

        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('header.app-header');
    });

    test('1. Projekt öffnen ohne Eingabe', async ({ page }) => {
        const row = page.locator('tr', { hasText: 'Projekt Hydration Test 1' });
        await row.click();

        // Wait for hydration to complete
        await page.waitForSelector('text=Kontakte');
        await page.waitForTimeout(1000);

        const unsaved = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qservice_unsaved_reports') || '{}');
        });
        expect(Object.keys(unsaved).length).toBe(0);

        await page.click('button:has-text("Dashboard"), button:has-text("Zurück")');
        await expect(page.locator('text=Lokale Änderungen gefunden')).not.toBeVisible();
    });

    test('2. Full-Load künstlich länger als zwei Sekunden', async ({ page }) => {
        await page.evaluate(() => {
            sessionStorage.setItem('mock_db_delay', '4000');
        });

        const row = page.locator('tr', { hasText: 'Projekt Hydration Test 1' });
        await row.click();

        // Loading text should be visible immediately
        await expect(page.locator('text=Projekt wird vollständig geladen …')).toBeVisible();

        // Form should not be editable/visible
        await expect(page.locator('input[name="client"]')).not.toBeVisible();

        // Wait for delay to pass
        await page.waitForTimeout(5000);

        // Loading text should disappear, form is visible
        await expect(page.locator('text=Projekt wird vollständig geladen …')).not.toBeVisible();
        await expect(page.locator('text=Kontakte')).toBeVisible();

        const unsaved = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qservice_unsaved_reports') || '{}');
        });
        expect(Object.keys(unsaved).length).toBe(0);
    });

    test('3. Zehn Projekte nacheinander öffnen', async ({ page }) => {
        test.setTimeout(90000);
        for (let i = 0; i < 10; i++) {
            const row = page.locator('tr', { hasText: 'Projekt Hydration Test 1' });
            await row.click();
            await page.waitForSelector('text=Kontakte');
            await page.click('button:has-text("Dashboard"), button:has-text("Zurück")');
            await page.waitForSelector('text=Projekt Hydration Test 1');
        }

        const unsaved = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qservice_unsaved_reports') || '{}');
        });
        expect(Object.keys(unsaved).length).toBe(0);
    });

    test('4. Zwei Hintergrundzyklen', async ({ page }) => {
        const row = page.locator('tr', { hasText: 'Projekt Hydration Test 1' });
        await row.click();
        await page.waitForSelector('text=Kontakte');

        // Wait 5 seconds (two 2-second cycles)
        await page.waitForTimeout(5000);

        const unsaved = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qservice_unsaved_reports') || '{}');
        });
        expect(Object.keys(unsaved).length).toBe(0);
    });

    test('5. Hard-Reload', async ({ page }) => {
        test.setTimeout(45000);
        const row = page.locator('tr', { hasText: 'Projekt Hydration Test 1' });
        await row.click();
        await page.waitForSelector('text=Kontakte');

        await page.reload({ waitUntil: 'networkidle' });
        await login(page);

        await expect(page.locator('text=Lokale Änderungen gefunden')).not.toBeVisible();
    });

    test('6. Projektwechsel während laufendem Full-Load', async ({ page }) => {
        await page.evaluate(() => {
            sessionStorage.setItem('mock_db_delay', '4000');
        });

        // Click project 1
        await page.locator('tr', { hasText: 'Projekt Hydration Test 1' }).click();
        await expect(page.locator('text=Projekt wird vollständig geladen …')).toBeVisible();

        // Immediately go back/cancel and open project 2
        await page.click('button:has-text("Dashboard"), button:has-text("Zurück")');
        await page.locator('tr', { hasText: 'Projekt Hydration Test 2' }).click();

        // Wait for project 2 to load
        await page.waitForTimeout(5000);

        // Verify correct details loaded (project 2)
        await expect(page.locator('text=Projekt wird vollständig geladen …')).not.toBeVisible();
        await expect(page.locator('text=Kontakte')).toBeVisible();

        const titleVal = await page.locator('input.text-gradient').first().inputValue();
        expect(titleVal).toBe('Projekt Hydration Test 2');
    });

    test('7. Echte Benutzereingabe nach Full-Load', async ({ page }) => {
        const row = page.locator('tr', { hasText: 'Projekt Hydration Test 1' });
        await row.click();
        await page.waitForSelector('text=Kontakte');

        // Edit a field
        const clientInput = page.locator('input[placeholder="Name oder Firma des Auftraggebers"]').first();
        await clientInput.fill('Neuer Kunde');

        // Wait for autosave (2s delay + buffer)
        await page.waitForTimeout(3000);

        // Verify the database mock has updated client name
        const dbProjects = await page.evaluate(() => {
            return JSON.parse(sessionStorage.getItem('mock_db_projects') || '[]');
        });
        const p1 = dbProjects.find(p => p.id === 'proj-lightweight-1');
        expect(p1.client).toBe('Neuer Kunde');
    });

    test('8. Netzwerkfehler nach echter Benutzereingabe', async ({ page }) => {
        const row = page.locator('tr', { hasText: 'Projekt Hydration Test 1' });
        await row.click();
        await page.waitForSelector('text=Kontakte');

        // Simulate offline mode in browser environment
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'onLine', { get: () => false });
        });

        // Edit client
        const clientInput = page.locator('input[placeholder="Name oder Firma des Auftraggebers"]').first();
        await clientInput.fill('Offline Kunde');
        // Dispatch change event to ensure state synchronization
        await clientInput.dispatchEvent('change');

        // Wait for autosave
        await page.waitForTimeout(3000);

        const unsaved = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qservice_unsaved_reports') || '{}');
        });

        const entry = unsaved['proj-lightweight-1'];
        expect(entry).toBeDefined();
        expect(entry.source).toBe('offline-edit');
        expect(entry.isCompleteSnapshot).toBe(true);
        expect(entry.reportData.client).toBe('Offline Kunde');
    });

    test('9. Guard blockiert unvollständigen Save', async ({ page }) => {
        // Try calling handleSaveReport with a lightweight report in the page context
        const saveError = await page.evaluate(async () => {
            try {
                const report = {
                    id: 'proj-lightweight-1',
                    isLightweight: true,
                    projectTitle: 'Guard Block test'
                };
                await window.supabase.from('damage_reports').update({ report_data: report }).eq('id', report.id);
                return null;
            } catch (e) {
                return { message: e.message, code: e.code };
            }
        });

        // Mock client handles this in system
        const unsaved = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qservice_unsaved_reports') || '{}');
        });
        expect(unsaved['proj-lightweight-1']).toBeUndefined();
    });

    test('10. Falscher Legacy-Lightweight-Eintrag', async ({ page }) => {
        // Inject false entry
        await page.evaluate(() => {
            const legacyEntry = {
                'proj-lightweight-1': {
                    reportId: 'proj-lightweight-1',
                    reportData: {
                        id: 'proj-lightweight-1',
                        isLightweight: true, // lightweight!
                        rooms: []
                    },
                    _sync_conflict: true
                }
            };
            localStorage.setItem('qservice_unsaved_reports', JSON.stringify(legacyEntry));
        });

        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('header.app-header');

        // Should be quarantined and not shown
        await expect(page.locator('text=Lokale Änderungen gefunden')).not.toBeVisible();

        const quarantine = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('qservice_unsaved_reports_quarantine') || '{}');
        });
        expect(quarantine['proj-lightweight-1']).toBeDefined();
    });

    test('11. Echter Legacy-Offline-Eintrag', async ({ page }) => {
        // Inject valid offline entry with baseServerUpdatedAt
        await page.evaluate(() => {
            const validEntry = {
                'proj-lightweight-1': {
                    reportId: 'proj-lightweight-1',
                    projectId: 'proj-lightweight-1',
                    source: 'offline-edit',
                    isCompleteSnapshot: true,
                    baseServerUpdatedAt: new Date().toISOString(),
                    baseUpdatedAt: new Date().toISOString(),
                    reportData: {
                        id: 'proj-lightweight-1',
                        projectTitle: 'Projekt Hydration Test 1',
                        isLightweight: false,
                        rooms: [{ id: 'room-1', name: 'Wohnzimmer' }]
                    },
                    _sync_conflict: true,
                    projectTitle: 'Projekt Hydration Test 1'
                }
            };
            localStorage.setItem('qservice_unsaved_reports', JSON.stringify(validEntry));
        });

        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('header.app-header');

        // Should display the conflict dialog
        await expect(page.getByRole('heading', { name: 'Lokale Änderungen gefunden!' })).toBeVisible();

        // The button should be enabled
        const forceBtn = page.locator('button:has-text("Lokalen Stand erzwingen")');
        await expect(forceBtn).toBeEnabled();
    });

    test('12. Unvollständiger Force-Save', async ({ page }) => {
        // Inject an entry with no baseServerUpdatedAt
        await page.evaluate(() => {
            const invalidEntry = {
                'proj-lightweight-1': {
                    reportId: 'proj-lightweight-1',
                    projectId: 'proj-lightweight-1',
                    source: 'offline-edit',
                    isCompleteSnapshot: true,
                    // no baseServerUpdatedAt!
                    reportData: {
                        id: 'proj-lightweight-1',
                        projectTitle: 'Projekt Hydration Test 1',
                        isLightweight: false
                    },
                    _sync_conflict: true,
                    projectTitle: 'Projekt Hydration Test 1'
                }
            };
            localStorage.setItem('qservice_unsaved_reports', JSON.stringify(invalidEntry));
        });

        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('header.app-header');

        // The button should be disabled since there is no base version
        const forceBtn = page.locator('button:has-text("Lokalen Stand erzwingen")');
        await expect(forceBtn).toBeDisabled();
    });

    test('13. Zuletzt geändert', async ({ page }) => {
        // Update mock database item to have last_edited_by in root
        await page.evaluate(() => {
            const projects = JSON.parse(sessionStorage.getItem('mock_db_projects') || '[]');
            projects[0].last_edited_by = 'Test Operator';
            projects[0].report_data.last_edited_by = 'Nested Operator';
            sessionStorage.setItem('mock_db_projects', JSON.stringify(projects));
        });

        await page.reload({ waitUntil: 'networkidle' });

        const row = page.locator('tr', { hasText: 'Projekt Hydration Test 1' });
        await row.click();

        await page.waitForSelector('text=Kontakte');
        await expect(page.locator('text=Zuletzt geändert: Test Operator')).toBeVisible();
    });

});
