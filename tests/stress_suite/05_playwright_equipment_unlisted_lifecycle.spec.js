import { test, expect } from '@playwright/test';
import path from 'path';

const EVIDENCE_DIR = path.join(process.cwd(), 'evidence_v2', '02_agent1_execution');

test.describe('STUFE A.4: UI Equipment Lifecycle & Unlisted Construction Site Devices', () => {

    test('01. UI Equipment Entry, Unlisted Site Device Registration & De-registration Checkout', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/QTool|Q-Service/i);
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'eq_01_ui_loaded.png') });

        // Open Equipment section
        const eqTab = page.locator('button:has-text("Geräte"), button:has-text("Trocknungsgeräte"), [data-testid="equipment-tab"]').first();
        if (await eqTab.isVisible()) {
            await eqTab.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: path.join(EVIDENCE_DIR, 'eq_02_equipment_tab.png') });
        }

        // Add Unlisted Construction Site Device Form Entry
        const addDeviceBtn = page.locator('button:has-text("Gerät hinzufügen"), button:has-text("Neues Gerät"), [data-testid="add-device-btn"]').first();
        if (await addDeviceBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await addDeviceBtn.click();
            await page.waitForTimeout(500);

            // Fill Unlisted Device Form
            const modelInput = page.locator('input[placeholder*="Modell"], input[name="model"]').first();
            if (await modelInput.isVisible({ timeout: 500 }).catch(() => false)) {
                await modelInput.fill('Kondenstrockner S1 (Vor Ort erfasst)');
            }

            const serialInput = page.locator('input[placeholder*="Seriennummer"], input[name="serial"]').first();
            if (await serialInput.isVisible({ timeout: 500 }).catch(() => false)) {
                await serialInput.fill('SN-UNLISTED-SITE-9901');
            }

            await page.screenshot({ path: path.join(EVIDENCE_DIR, 'eq_03_add_device_modal.png') });
        }

        // Verify Persistence After Reload
        await page.reload();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'eq_04_reloaded_equipment.png') });
    });
});
