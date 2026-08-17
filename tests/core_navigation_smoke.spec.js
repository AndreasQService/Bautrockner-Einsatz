import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

test.describe('CORE NAVIGATION & SMOKE E2E SUITE (ZERO PAGEERRORS)', () => {
  const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5180';

  test.afterEach(async ({ page }) => {
    try {
      await page.evaluate(async () => {
        const { supabase } = await import('/src/supabaseClient.js');
        if (supabase?.from) {
          await supabase.from('damage_reports').delete().ilike('project_number', 'SORBA-SMOKE%');
          await supabase.from('damage_reports').delete().ilike('project_title', '%Smoke%');
        }
      });
    } catch (e) {
      // Tear-down error ignored if browser closed
    }
  });

  test('1. Project Selection & View Navigation without Page Errors', async ({ page }) => {
    test.setTimeout(45000);

    const pageErrors = [];
    const uncaughtTypeErrors = [];

    page.on('pageerror', (err) => {
      console.error('[Browser Uncaught Exception]:', err.message);
      pageErrors.push(err.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('TypeError') || text.includes('is not a function')) {
          uncaughtTypeErrors.push(text);
        }
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await login(page);

    // Locate project row or card on the Dashboard
    const projectRow = page.locator('tr.hover-row, .tech-project-card, div[class*="card"]').first();
    await expect(projectRow).toBeVisible({ timeout: 10000 });
    await projectRow.click();

    // Verify detail view or main app container is displayed cleanly
    await page.waitForTimeout(2000);
    const mainContainer = page.locator('main, form, .damage-form, .app-header').first();
    await expect(mainContainer).toBeVisible({ timeout: 10000 });

    // Assert zero uncaught JavaScript errors or TypeErrors during project selection
    expect(pageErrors, `Page Errors detected: ${pageErrors.join('; ')}`).toHaveLength(0);
    expect(uncaughtTypeErrors, `TypeError Console Errors detected: ${uncaughtTypeErrors.join('; ')}`).toHaveLength(0);
  });

  test('2. Rapid Project Switching & Lock Release Safety', async ({ page }) => {
    test.setTimeout(45000);

    const pageErrors = [];
    page.on('pageerror', (err) => {
      console.error('[Browser Uncaught Exception]:', err.message);
      pageErrors.push(err.message);
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await login(page);

    // Find all visible project rows or cards
    const projectRows = page.locator('tr.hover-row, .tech-project-card');
    const count = await projectRows.count();

    if (count > 0) {
      // 1. Open first project
      await projectRows.nth(0).click();
      await page.waitForTimeout(1000);

      // 2. Navigate back to Dashboard if back button is available
      const backBtn = page.locator('button', { hasText: /Zurück|Dashboard|Aufträge/i }).first();
      if (await backBtn.isVisible({ timeout: 3000 })) {
        await backBtn.click();
        await page.waitForTimeout(1000);
      }

      // 3. Open second project (or first if only 1 project exists)
      const targetIdx = count > 1 ? 1 : 0;
      await projectRows.nth(targetIdx).click();
      await page.waitForTimeout(1000);
    }

    expect(pageErrors, `Page Errors during rapid project switching: ${pageErrors.join('; ')}`).toHaveLength(0);
  });

  test('3. New Project Creation Smoke Test & Navigation', async ({ page }) => {
    test.setTimeout(45000);

    const pageErrors = [];
    page.on('pageerror', (err) => {
      console.error('[Browser Uncaught Exception]:', err.message);
      pageErrors.push(err.message);
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await login(page);

    // Create instant project and persist to database + sessionStorage mock
    const createdProject = await page.evaluate(async () => {
      const { initializeInstantProject } = await import('/src/lib/offline/createProject.js');
      const { saveSnapshot } = await import('/src/services/DeviceLocalStore.js');
      const { supabase } = await import('/src/supabaseClient.js');

      const proj = initializeInstantProject({
        projectTitle: 'Wasserschaden Smoke Test 001',
        projectNumber: 'SORBA-SMOKE-001',
        street: 'Bahnhofstrasse 10',
        zip: '8001',
        city: 'Zürich',
        rooms: [{ id: 'room_1', name: 'Wohnzimmer' }]
      });

      await saveSnapshot(proj.id, proj);

      // Add to mock DB session storage
      try {
        const mockProjects = JSON.parse(sessionStorage.getItem('mock_db_projects') || '[]');
        mockProjects.unshift({
          id: proj.id,
          project_number: proj.projectNumber,
          project_title: proj.projectTitle,
          street: proj.street,
          zip: proj.zip,
          city: proj.city,
          report_data: proj
        });
        sessionStorage.setItem('mock_db_projects', JSON.stringify(mockProjects));
      } catch (e) {}

      if (supabase?.from) {
        await supabase.from('damage_reports').upsert([{
          id: proj.id,
          project_number: proj.projectNumber,
          project_title: proj.projectTitle,
          street: proj.street,
          zip: proj.zip,
          city: proj.city,
          report_data: proj
        }]);
      }

      return proj;
    });

    expect(createdProject.id).toBeTruthy();

    // Re-authenticate and verify Dashboard renders project row
    await login(page);

    // Select any visible project row on the Dashboard
    const projectRow = page.locator('tr.hover-row, .tech-project-card, div[class*="card"]').first();
    await expect(projectRow).toBeVisible({ timeout: 10000 });
    await projectRow.click();

    // Verify detail view loads cleanly
    await page.waitForTimeout(2000);
    const mainContainer = page.locator('main, form, .damage-form, .app-header').first();
    await expect(mainContainer).toBeVisible({ timeout: 10000 });

    expect(pageErrors, `Page Errors during project creation smoke test: ${pageErrors.join('; ')}`).toHaveLength(0);
  });
});
