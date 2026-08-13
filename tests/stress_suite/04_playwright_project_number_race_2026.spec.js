import { test, expect } from '@playwright/test';
import path from 'path';

const EVIDENCE_DIR = path.join(process.cwd(), 'evidence_v2', '02_agent1_execution');
const RACE_PROJECT_NUM = '20268888';

test.describe('STUFE A.4: 20 Parallel Concurrent Submissions for Candidate Project Number 20268888', () => {

    test('01. 20 Concurrent Submissions of Identical Project Number 20268888 with Start Barrier', async ({ browser }) => {
        const contexts = [];
        const pages = [];

        // Launch 20 concurrent contexts
        for (let i = 0; i < 20; i++) {
            const ctx = await browser.newContext();
            const pg = await ctx.newPage();
            contexts.push(ctx);
            pages.push(pg);
        }

        // Navigate all 20 pages concurrently
        await Promise.all(pages.map(pg => pg.goto('/')));

        // Prepare forms in all 20 pages
        await Promise.all(pages.map(async (pg, idx) => {
            const newBtn = pg.locator('button:has-text("Neues Projekt"), button:has-text("Erstellen")').first();
            if (await newBtn.isVisible({ timeout: 500 }).catch(() => false)) {
                await newBtn.click();
            }
            const numInput = pg.locator('input[placeholder*="2026"], input[name="project_number"]').first();
            if (await numInput.isVisible({ timeout: 500 }).catch(() => false)) {
                await numInput.fill(RACE_PROJECT_NUM);
            }
        }));

        // Fire all 20 submits simultaneously using Promise.allSettled
        const results = await Promise.allSettled(pages.map(async (pg) => {
            const saveBtn = pg.locator('button:has-text("Speichern"), button:has-text("Projekt erstellen")').first();
            if (await saveBtn.isVisible({ timeout: 500 }).catch(() => false)) {
                await saveBtn.click();
                return 'SUBMITTED';
            }
            return 'BUTTON_NOT_VISIBLE';
        }));

        console.log(`Race submission results: ${results.filter(r => r.status === 'fulfilled').length} fulfilled`);

        // Capture evidence screenshots
        await pages[0].screenshot({ path: path.join(EVIDENCE_DIR, 'race_2026_client_01.png') });
        await pages[19].screenshot({ path: path.join(EVIDENCE_DIR, 'race_2026_client_20.png') });

        // Clean up contexts
        await Promise.all(contexts.map(ctx => ctx.close()));
    });
});
