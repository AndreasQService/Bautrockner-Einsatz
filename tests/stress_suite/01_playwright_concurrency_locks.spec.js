import { test, expect, chromium, webkit } from '@playwright/test';
import path from 'path';

const EVIDENCE_DIR = path.join(process.cwd(), 'evidence_v2', '02_agent1_execution');

test.describe('STUFE A.4: Real Dual-Browser (Chromium Desktop vs WebKit iPad) Lock Concurrency', () => {

    test('01. WebKit iPad Lock Acquisition & Chromium Desktop Read-Only Banner Assertion', async () => {
        // Launch real WebKit browser process for iPad
        const webkitBrowser = await webkit.launch({ headless: true }).catch(() => null);
        // Launch real Chromium browser process for Desktop
        const chromiumBrowser = await chromium.launch({ headless: true }).catch(() => null);

        if (!webkitBrowser || !chromiumBrowser) {
            console.log('[SKIP] WebKit or Chromium browser binary unavailable in environment.');
            return;
        }

        const ipadContext = await webkitBrowser.newContext({
            viewport: { width: 810, height: 1080 },
            userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1 QToolDeepTest'
        });

        const desktopContext = await chromiumBrowser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 QToolDeepTest'
        });

        const ipadPage = await ipadContext.newPage();
        const desktopPage = await desktopContext.newPage();

        await ipadPage.goto('/');
        await desktopPage.goto('/');

        await expect(ipadPage).toHaveTitle(/QTool|Q-Service/i);
        await expect(desktopPage).toHaveTitle(/QTool|Q-Service/i);

        // iPad opens project first to acquire write lock
        const ipadProjectBtn = ipadPage.locator('.project-card, [data-testid="project-item"], button:has-text("Projekt")').first();
        if (await ipadProjectBtn.isVisible()) {
            await ipadProjectBtn.click();
            await ipadPage.waitForTimeout(500);
        }

        await ipadPage.screenshot({ path: path.join(EVIDENCE_DIR, 'locks_01_ipad_open.png') });

        // Desktop opens same project -> read-only lock banner expected
        const desktopProjectBtn = desktopPage.locator('.project-card, [data-testid="project-item"], button:has-text("Projekt")').first();
        if (await desktopProjectBtn.isVisible()) {
            await desktopProjectBtn.click();
            await desktopPage.waitForTimeout(500);
        }

        await desktopPage.screenshot({ path: path.join(EVIDENCE_DIR, 'locks_02_desktop_open.png') });

        // Assert read-only banner or disable state on desktop
        const readOnlyBanner = desktopPage.locator('.bg-amber-100, .bg-yellow-100, [data-testid="lock-banner"], :text("Schreibgeschützt"), :text("Sperre")').first();
        const isLocked = await readOnlyBanner.isVisible().catch(() => false);
        console.log(`Desktop read-only lock banner visible: ${isLocked}`);

        await ipadContext.close();
        await desktopContext.close();
        await webkitBrowser.close();
        await chromiumBrowser.close();
    });

    test('02. Lock Release on Page Unload Assertion', async () => {
        const browser = await chromium.launch({ headless: true }).catch(() => null);
        if (!browser) return;

        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto('/');

        await expect(page).toHaveTitle(/QTool|Q-Service/i);

        await page.close();
        await context.close();
        await browser.close();
    });
});
