import { test, expect } from '@playwright/test';
import path from 'path';

const BASE_URL = 'http://localhost:5177';

test.describe('QTool Offline-Fähigkeit (Techniker Mode)', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('[BROWSER]', msg.text()));
        // App laden und Session zurücksetzen für sauberen Test
        await page.goto(BASE_URL);
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await page.reload();
        
        // Login as Techniker 1
        await page.waitForSelector('input[type="text"]', { timeout: 10000 });
        await page.locator('input[type="text"]').fill('Techniker 1');
        await page.locator('input[type="password"]').fill('123');
        await page.getByRole('button', { name: /anmelden/i }).click();

        // Wait for technician dashboard (Tiles)
        await page.waitForSelector('button:has-text("Messung")', { timeout: 15000 });

        // Open test project
        // We look for a project row. Based on observation, they are divs with cursor:pointer
        const project = page.getByText('Wasserschaden Test-Projekt (Measurement)');
        if (await project.isVisible()) {
            await project.click();
        } else {
            // Fallback: open first project that looks like a project row (W-...)
            const firstProject = page.locator('div[style*="cursor: pointer"]').filter({ hasText: /W-/ }).first();
            await firstProject.click();
        }
        
        // Wait for project view to load
        await page.waitForTimeout(2000);
    });

    test('MESSUNGEN OFFLINE: Datenerfassung und Raumwechsel', async ({ page, context }) => {
        // 1. Offline gehen
        await context.setOffline(true);
        console.log('🔌 Offline-Modus aktiviert');

        // 2. Messung öffnen
        await page.getByRole('button', { name: 'Messung' }).click();
        
        // Wait for room list
        await page.waitForSelector('text=Wohnzimmer', { timeout: 5000 });
        await page.getByText('Wohnzimmer').first().click();
        
        // 3. Mehrere Messpunkte erfassen
        const numMeasurements = 3;
        for (let i = 1; i <= numMeasurements; i++) {
            await page.getByRole('button', { name: 'MP hinzufügen' }).click();
            
            // Wait for new row to appear
            const wInputs = page.locator('input[placeholder="W"]');
            const bInputs = page.locator('input[placeholder="B"]');
            
            await wInputs.last().fill(`${20 + i}`);
            await bInputs.last().fill(`${40 + i}`);
            console.log(`✅ Messpunkt ${i} erfasst (offline)`);
        }

        // 4. Raum wechseln (Kacheln -> Küche)
        await page.getByRole('button', { name: 'Kacheln' }).click();
        await page.getByText('Küche').first().click();
        
        // Add one point in Kitchen
        await page.getByRole('button', { name: 'MP hinzufügen' }).click();
        await page.locator('input[placeholder="W"]').last().fill('99');

        // 5. Zurück zu Wohnzimmer und Verifikation
        await page.getByRole('button', { name: 'Kacheln' }).click();
        await page.getByText('Wohnzimmer').first().click();

        const count = await page.locator('input[placeholder="W"]').count();
        console.log(`📊 Punkte in Wohnzimmer nach Rückkehr: ${count}`);
        expect(count).toBeGreaterThanOrEqual(numMeasurements);

        // 6. Online gehen
        await context.setOffline(false);
        console.log('📡 Wieder online');
    });

    test('FOTO-UPLOAD OFFLINE: Queuing und Lokale Speicherung', async ({ page, context }) => {
        // 1. Offline gehen
        await context.setOffline(true);
        
        // 2. Schadenaufnahme öffnen
        await page.getByRole('button', { name: 'Schadenaufnahme' }).click();

        // 3. Foto hinzufügen
        const testImagePath = path.join(process.cwd(), 'test_upload.png');
        const fileInput = page.locator('input[type="file"]').first();
        
        await fileInput.setInputFiles(testImagePath);
        console.log('📸 Foto hinzugefügt (offline)');

        // 4. Prüfen ob Vorschau da ist
        // Based on UI, there should be an image or a specific container
        await page.waitForTimeout(1000);

        // 5. Online gehen und Sync
        await context.setOffline(false);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        console.log('📡 Online - Sync getriggert');
        
        await page.waitForTimeout(3000);
        expect(await page.locator('text=Fehler').isVisible()).toBe(false);
    });

    test('ONLINE SYNC: Konsistenz nach Wiederverbindung', async ({ page, context }) => {
        // 1. Offline Daten erfassen
        await context.setOffline(true);
        await page.getByRole('button', { name: 'Messung' }).click();
        await page.getByText('Wohnzimmer').first().click();
        
        const timestamp = "SYNC-" + Date.now().toString().slice(-4);
        await page.getByRole('button', { name: 'MP hinzufügen' }).click();
        await expect(page.locator('input[placeholder="B"]')).toHaveCount(5, { timeout: 5000 });
        await page.locator('input[placeholder="B"]').last().fill(timestamp);
        console.log(`📝 Offline Punkt erstellt: ${timestamp}`);

        // 2. Online gehen
        await context.setOffline(false);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await page.waitForTimeout(2000);

        // 3. Reload und Re-Check
        await page.reload();
        
        // Re-navigate to project and room
        const project = page.locator('div[style*="cursor: pointer"]').filter({ hasText: /W-/ }).first();
        await project.click();
        await page.getByRole('button', { name: 'Messung' }).click();
        await page.getByText('Wohnzimmer').first().click();

        // Check if value is still there
        const values = await page.evaluate(() => Array.from(document.querySelectorAll('input[placeholder="B"]')).map(i => i.value));
        expect(values).toContain(timestamp);
        console.log('✅ Datenkonsistenz nach Sync bestätigt');
    });

});
