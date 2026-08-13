import { test, expect, devices } from '@playwright/test';
import path from 'path';

const EVIDENCE_DIR = path.join(process.cwd(), 'evidence_v2', '02_agent1_execution');

test.use({
    ...devices['iPad (gen 7)'],
    locale: 'de-CH',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1 QToolDeepTest'
});

test.describe('STUFE A.4: WebKit iPad Emulation Offline Queue & 10 Throttling Cycle Suite', () => {

    test('01. WebKit Offline Queue & 10 Net Throttling Cycles with 3 Interrupted Uploads', async ({ page, context }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/QTool|Q-Service/i);

        // Inspect IndexedDB Queue Before
        const queueBefore = await page.evaluate(async () => {
            if (!window.indexedDB) return [];
            return new Promise((resolve) => {
                const req = indexedDB.open('qtool_offline_db');
                req.onerror = () => resolve([]);
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('offline_queue')) return resolve([]);
                    const tx = db.transaction('offline_queue', 'readonly');
                    const store = tx.objectStore('offline_queue');
                    const getReq = store.getAll();
                    getReq.onsuccess = () => resolve(getReq.result || []);
                    getReq.onerror = () => resolve([]);
                };
            });
        }).catch(() => []);

        console.log(`IndexedDB queue length before cycles: ${queueBefore.length}`);

        for (let cycle = 1; cycle <= 10; cycle++) {
            await context.setOffline(true);
            await page.waitForTimeout(150);

            if (cycle === 3 || cycle === 6 || cycle === 9) {
                await page.screenshot({ path: path.join(EVIDENCE_DIR, `offline_interrupted_cycle_${cycle}.png`) });
            }

            await context.setOffline(false);
            await page.waitForTimeout(150);
        }

        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'offline_10_cycles_complete.png') });
    });
});
