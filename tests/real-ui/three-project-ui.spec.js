import { test, expect } from '@playwright/test';

const TEST_HOST = 'qtool-test.vercel.app';
const TEST_SUPABASE_REF = 'aoxduqspiezzyqeqyzzl';
const LIVE_SUPABASE_REF = 'yxdoecdqttgdncgbzyus';

function requiredProjectLabels() {
  const labels = String(process.env.QTOOL_UI_PROJECTS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (labels.length !== 3 || labels.some(label => !label.includes('TEST__'))) {
    throw new Error('QTOOL_UI_PROJECTS muss exakt drei kommagetrennte TEST__-Projektbezeichnungen enthalten.');
  }
  if (new Set(labels).size !== 3) throw new Error('Die drei TEST__-Projektbezeichnungen müssen eindeutig sein.');
  return labels;
}

async function assertTestIsolation(page) {
  const current = new URL(page.url());
  expect(current.hostname, 'Der reale UI-Test darf nur auf QTool-Test laufen.').toBe(TEST_HOST);

  const config = await page.evaluate(() => ({
    supabaseUrl: import.meta?.env?.VITE_SUPABASE_URL || null,
    marker: document.body.innerText,
  })).catch(() => ({ supabaseUrl: null, marker: '' }));

  if (config.supabaseUrl) {
    expect(config.supabaseUrl).toContain(TEST_SUPABASE_REF);
    expect(config.supabaseUrl).not.toContain(LIVE_SUPABASE_REF);
  }
  expect(config.marker, 'Die Seite muss sichtbar als Testumgebung markiert sein.').toMatch(/QTool[- ]Test|Testumgebung/i);
}

async function findProjectRow(page, label) {
  const search = page.locator('input[placeholder*="Projekt suchen"], input[placeholder*="Projekte durchsuchen"]').first();
  await expect(search, 'Projekt-Suchfeld fehlt.').toBeVisible();
  await search.fill(label);

  const row = page.locator('tr, .tech-project-card').filter({ hasText: label }).first();
  await expect(row, `Testprojekt ${label} wurde nicht eindeutig gefunden.`).toBeVisible();
  await expect(page.locator('tr, .tech-project-card').filter({ hasText: label })).toHaveCount(1);
  return row;
}

async function openAndVerify(page, label) {
  const row = await findProjectRow(page, label);
  await row.click();

  await expect(page.getByText(label, { exact: false }).first(), `Projekt ${label} wurde nicht geöffnet.`).toBeVisible();
  await expect(
    page.getByText(/Projekt offline verfügbar/i),
    `Projekt ${label} wurde nicht vollständig lokal materialisiert.`,
  ).toBeVisible({ timeout: 30_000 });

  // Das geöffnete Projekt muss mindestens eine fachliche Projektansicht zeigen.
  await expect(page.getByText(/Auftrag.*Schadenort|Schadensbericht|Messprotokoll|Geräte/i).first()).toBeVisible();

  const exit = page.getByRole('button', { name: /Synchronisieren.*Projekt verlassen/i });
  await expect(exit, 'Der zwingende Sync-und-Verlassen-Button fehlt.').toBeVisible();
  await exit.click();

  await expect(page.getByText(/Supabase.*OK/i)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/OneDrive.*OK/i)).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('header.app-header')).toBeVisible({ timeout: 15_000 });
}

test.describe.serial('Drei reale Projekte per UI öffnen und sicher verlassen', () => {
  test('öffnet drei TEST__-Projekte nacheinander mit Maus-/Tastatur-Semantik', async ({ page }) => {
    test.skip(process.env.QTOOL_REAL_UI_EXECUTE !== 'YES_TEST_ONLY', 'Explizites Test-only-Ausführungsgate fehlt.');
    const labels = requiredProjectLabels();

    const observedHosts = new Set();
    let blockedLiveRequest = null;
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.includes(LIVE_SUPABASE_REF)) {
        blockedLiveRequest = url.replace(/[?#].*$/, '');
        await route.abort('blockedbyclient');
        return;
      }
      await route.continue();
    });
    page.on('request', request => {
      try { observedHosts.add(new URL(request.url()).hostname); } catch { /* ignore non-URL requests */ }
    });

    await page.goto('/');
    expect(blockedLiveRequest, 'Ein Live-Supabase-Aufruf wurde vor dem Netzwerk blockiert.').toBeNull();
    await assertTestIsolation(page);
    await expect(page.locator('input[type="password"]'), 'Storage-State ist nicht angemeldet.').toHaveCount(0);
    await expect(page.locator('header.app-header')).toBeVisible();

    for (const label of labels) await openAndVerify(page, label);

    expect(blockedLiveRequest, 'Ein Live-Supabase-Aufruf wurde vor dem Netzwerk blockiert.').toBeNull();
    expect([...observedHosts].some(host => host.includes(TEST_SUPABASE_REF)), 'Kein Zugriff auf Test-Supabase beobachtet.').toBe(true);
    expect([...observedHosts].some(host => host.includes(LIVE_SUPABASE_REF)), 'Live-Supabase wurde kontaktiert.').toBe(false);
  });
});
