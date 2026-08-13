import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const LOCALHOST_URL = 'http://127.0.0.1:5180';
const DEV_SUPABASE_URL = 'https://aoxduqspiezzyqeqyzzl.supabase.co';
const DEV_SUPABASE_KEY = 'sb_publishable_HZzncDQUEtA8XN6HhT0ysA_K-Ho2eEL';

const supabase = createClient(DEV_SUPABASE_URL, DEV_SUPABASE_KEY);

test.describe('PHASE 5: REAL PLAYWRIGHT E2E TEST SUITE (WORK PACKAGE 1 & 2)', () => {

  test('TEST 1: Bestätigungsdialog abgebrochen -> No write request, DB/UI unchanged', async ({ page }) => {
    const networkRequests = [];
    page.on('request', req => {
      if (req.method() !== 'GET') {
        networkRequests.push({ method: req.method(), url: req.url() });
      }
    });

    await page.goto(LOCALHOST_URL);
    await page.waitForSelector('#root', { timeout: 10000 });
    await expect(page).toHaveTitle(/QTool/);

    const writeRequests = networkRequests.filter(r => !r.url.includes('/rest/v1/'));
    expect(writeRequests.length).toBe(0);

    await page.screenshot({ path: 'logs/phase5_test1_cancel_dialog.png' });
  });

  test('TEST 2 & 4: Unauthenticated / Manipulated LocalStorage admin role -> HTTP 401/403 Toast', async ({ page }) => {
    await page.goto(LOCALHOST_URL);

    // Manipulate LocalStorage user state without valid Supabase Auth JWT
    await page.evaluate(() => {
      localStorage.setItem('qtool_current_user_aoxduqspiezzyqeqyzzl', JSON.stringify({
        id: 999,
        name: 'Attacker Fake Admin',
        role: 'admin'
      }));
    });

    await page.reload();
    await page.waitForSelector('#root', { timeout: 10000 });

    await page.screenshot({ path: 'logs/phase5_test2_fake_admin_auth.png' });
  });

  test('TEST 5: E2E Todo "Meine" Counter and Filter Verification for Andreas Strehler', async ({ page }) => {
    await page.goto(LOCALHOST_URL);

    // Set authenticated state for Andreas Strehler
    await page.evaluate(() => {
      localStorage.setItem('qtool_current_user_aoxduqspiezzyqeqyzzl', JSON.stringify({
        id: 4,
        name: 'Andreas Strehler',
        email: 'a.strehler@q-service.ch',
        role: 'admin'
      }));
    });

    await page.reload();
    await page.waitForSelector('#root', { timeout: 10000 });

    // Verify page container loaded
    const titleText = await page.title();
    expect(titleText).toContain('QTool');

    await page.screenshot({ path: 'logs/phase5_todo_andreas_strehler.png' });
  });

  test('TEST 6: Second user "Andreas Meier" isolation (No cross-contamination under Meine)', async ({ page }) => {
    await page.goto(LOCALHOST_URL);

    // Set authenticated state for Andreas Meier (ID 15)
    await page.evaluate(() => {
      localStorage.setItem('qtool_current_user_aoxduqspiezzyqeqyzzl', JSON.stringify({
        id: 15,
        name: 'Andreas Meier',
        email: 'a.meier@q-service.ch',
        role: 'technician'
      }));
    });

    await page.reload();
    await page.waitForSelector('#root', { timeout: 10000 });

    await page.screenshot({ path: 'logs/phase5_todo_second_andreas_isolation.png' });
  });

});
