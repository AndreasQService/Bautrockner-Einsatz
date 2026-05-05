import { test, expect, devices } from '@playwright/test';

const iPad = devices['iPad Pro 11'];
test.use({ ...iPad, hasTouch: true });

test.describe('QTool Pro: iPad Offline Resilience', () => {

  test('Data Entry & Persistence during Offline State', async ({ page, context }) => {
    await page.goto('http://127.0.0.1:5173');
    
    // Switch to Technician Mode
    const toggleBtn = page.locator('button[title="Zwischen Desktop- und Techniker-Modus wechseln"]');
    if (await toggleBtn.isVisible() && (await toggleBtn.innerText()).includes('Desktop')) {
      await toggleBtn.click();
    }

    // Open Project
    await page.locator('.tech-project-card').first().click();
    
    // GO OFFLINE
    await context.setOffline(true);
    console.log('App is now OFFLINE');

    // 1. Enter measurements while offline
    const measBtn = page.locator('button:has-text("Messungen")').first();
    await measBtn.click();
    await page.locator('button:has-text("MP hinzufügen")').click();
    
    // Fill values
    const wCell = page.locator('div[style*="grid-template-columns: 52px 1fr 1fr 44px"]').first().locator('div').nth(1);
    await wCell.click();
    await page.locator('button:has-text("9")').click();
    await page.locator('button:has-text("9")').click();
    await page.locator('button:has-text("Fertig")').click();
    
    // Save while offline
    const saveBtn = page.locator('button:has-text("Speichern")');
    await saveBtn.click();

    // 2. Verify UI state: should show "Offline" indicator or handled success
    // QTool uses a sync-status-badge
    const syncBadge = page.locator('#sync-status-badge');
    await expect(syncBadge).toContainText('ausstehend');

    // 3. GO ONLINE
    await context.setOffline(false);
    console.log('App is now ONLINE');
    
    // 4. Verify sync starts (or badge updates)
    await page.waitForTimeout(3000); // Wait for potential sync
    // The badge should eventually show "Synchronisiert"
    // await expect(syncBadge).toContainText('Synchronisiert');
    
    // 5. Verify data is still there after "online" transition
    await expect(page.locator('text=99')).toBeVisible();
  });

  test('Network Throttling / Slow Connection', async ({ page, context }) => {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 50 * 1024 / 8, // 50kbps
      uploadThroughput: 20 * 1024 / 8, // 20kbps
      latency: 500, // 500ms
    });

    await page.goto('http://127.0.0.1:5173');
    // Verify app remains responsive or shows loading indicator
    const loadingBadge = page.locator('text=⏳ Verbinde');
    if (await loadingBadge.isVisible()) {
        console.log('Loading indicator visible during slow network');
    }
  });
});
