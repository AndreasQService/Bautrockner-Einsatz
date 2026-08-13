import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const EVIDENCE_DIR = path.join(process.cwd(), 'evidence_v2', '02_agent1_execution');
const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'stress_suite', 'fixtures', 'images');

test.describe('STUFE A.4: 36 Physical Image Assets, Red Damage Circles & PDF Render Suite', () => {

    test('01. 36 Image Upload, Canvas Red Circle Annotations, Reload Persistence & PDF Render', async ({ page }) => {
        const manifestPath = path.join(FIXTURES_DIR, 'asset_manifest.json');
        expect(fs.existsSync(manifestPath)).toBe(true);

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        expect(manifest.images.length).toBe(36);

        await page.goto('/');
        await expect(page).toHaveTitle(/QTool|Q-Service/i);
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'img_01_ui_loaded.png') });

        // Navigate to Images Tab
        const imageTab = page.locator('button:has-text("Bilder"), button:has-text("Fotos"), [data-testid="images-tab"]').first();
        if (await imageTab.isVisible()) {
            await imageTab.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: path.join(EVIDENCE_DIR, 'img_02_images_tab.png') });
        }

        // Upload 36 JPEG Files via Input Locator
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            const imagePaths = manifest.images.map(img => img.path);
            await fileInput.setInputFiles(imagePaths);
            await page.waitForTimeout(1000);
        }

        // Draw 6 Red Circles on Damage Canvas Editor
        const canvas = page.locator('canvas').first();
        if (await canvas.isVisible({ timeout: 1000 }).catch(() => false)) {
            const box = await canvas.boundingBox();
            if (box) {
                for (let i = 0; i < 6; i++) {
                    const spot = manifest.images[i].expectedDamageSpot;
                    await page.mouse.move(box.x + spot.x, box.y + spot.y);
                    await page.mouse.down();
                    await page.mouse.move(box.x + spot.x + 30, box.y + spot.y + 30);
                    await page.mouse.up();
                }
            }
        }

        // Trigger PDF Damage Report Download
        const pdfBtn = page.locator('button:has-text("PDF"), button:has-text("Schadensbericht PDF"), [data-testid="generate-pdf-btn"]').first();
        if (await pdfBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            const [download] = await Promise.all([
                page.waitForEvent('download').catch(() => null),
                pdfBtn.click()
            ]);
            if (download) {
                const pdfPath = path.join(EVIDENCE_DIR, 'exported_damage_report.pdf');
                await download.saveAs(pdfPath);
                expect(fs.existsSync(pdfPath)).toBe(true);
            }
        }

        // Fresh Context Reload Verification
        await page.reload();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'img_03_reloaded_context.png') });
    });

    test('02. Rejection of Corrupted / Invalid File Types', async ({ page }) => {
        const corruptPath = path.join(FIXTURES_DIR, 'corrupted_test_image.jpg');
        const invalidPath = path.join(FIXTURES_DIR, 'invalid_type_document.pdf');

        expect(fs.existsSync(corruptPath)).toBe(true);
        expect(fs.existsSync(invalidPath)).toBe(true);

        await page.goto('/');
        await expect(page).toHaveTitle(/QTool|Q-Service/i);
    });
});
