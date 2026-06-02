import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';
import fs from 'fs';
import path from 'path';

test('Verify PDF generation and size on dev server', async ({ page }) => {
    // Increase test timeout to 90 seconds to allow slow rendering to complete
    test.setTimeout(90000);

    console.log('[TEST] Logging in...');
    await login(page);

    console.log('[TEST] Navigating and searching for project "poststrasse"...');
    await page.goto('/');
    await page.waitForSelector('header.app-header', { timeout: 15000 });

    // Fill all search inputs on the page to make sure we filter all tables
    const searchInputs = await page.locator('input[placeholder*="such"], input[placeholder*="Such"], input[type="search"]').all();
    console.log(`[TEST] Found ${searchInputs.length} search inputs. Filling them with "poststrasse"...`);
    for (const input of searchInputs) {
        await input.fill('poststrasse');
    }
    await page.waitForTimeout(2000);

    // Click the specific row containing the project name "poststrasse"
    console.log('[TEST] Looking for table row with "poststrasse"...');
    const projectRow = page.locator('tr').filter({ hasText: /poststrasse/i }).first();
    await expect(projectRow).toBeVisible({ timeout: 12000 });
    await projectRow.click();
    console.log('[TEST] Row clicked, waiting for project details to open...');
    await page.waitForTimeout(3000);

    // Scroll down to the bottom of the page/container to find the PDF button
    console.log('[TEST] Scrolling down and searching for the PDF button...');
    const pdfBtn = page.locator('button').filter({ hasText: /schadensbericht/i }).first();
    await pdfBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1000);

    // Verify it is visible
    await expect(pdfBtn).toBeVisible({ timeout: 15000 });

    // Click the button and wait for the file download
    console.log('[TEST] Clicking PDF button and waiting for download...');
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await pdfBtn.click();
    const download = await downloadPromise;

    // Save the downloaded PDF to the scratch folder to measure it
    const tempPath = path.join('C:\\QTool\\scratch', download.suggestedFilename());
    await download.saveAs(tempPath);

    const stats = fs.statSync(tempPath);
    const sizeInKb = Math.round(stats.size / 1024);
    const sizeInMb = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log(`\n==================================================`);
    console.log(`[TEST SUCCESS] PDF Name: ${download.suggestedFilename()}`);
    console.log(`[TEST SUCCESS] PDF File Size: ${sizeInKb} KB (${sizeInMb} MB)`);
    console.log(`==================================================\n`);

    // Clean up the temporary file
    fs.unlinkSync(tempPath);

    // We expect the PDF to be well under 4 MB now (instead of 14 MB!)
    expect(stats.size).toBeLessThan(4 * 1024 * 1024);
    console.log('[TEST] Completed successfully!');
});
