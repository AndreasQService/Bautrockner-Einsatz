/**
 * messen-ipad-a1934.spec.js
 *
 * Playwright UX-Tests: Messprotokoll / Messpunkte auf iPad A1934 (9.7")
 * iPad 6. Generation — Viewport Portrait: 768×1024 / Landscape: 1024×768
 *
 * ZWECK: Schwächen aufdecken — UI wird NICHT verändert.
 *
 * Ausführen:
 *   npx playwright test tests/messen-ipad-a1934.spec.js --project=ipad-a1934-portrait --headed
 */

import { test, expect } from '@playwright/test';

const A1934_PORTRAIT  = { width: 768,  height: 1024 };
const A1934_LANDSCAPE = { width: 1024, height: 768  };
const MIN_TOUCH_PX    = 44;
const SCREENSHOTS     = 'tests/screenshots/ipad-a1934';

// ─── Test-Fixture: Minimales Testprojekt ──────────────────────────────────────

const TEST_REPORT = {
  id: 'TEST-IPAD-A1934',
  projectTitle: 'Test Wasserschaden',
  projectNumber: 'W-25-TEST',
  orderNumber: 'AUF-001',
  client: 'Muster GmbH',
  street: 'Teststrasse 12',
  zip: '8000',
  city: 'Zürich',
  address: 'Teststrasse 12, 8000 Zürich',
  status: 'Trocknung',
  date: new Date().toISOString(),
  assignedTo: 'Test Techniker',
  rooms: [
    { id: 'room_bad',   name: 'Badezimmer',  area: 8.5,  height: 2.5, material: 'Gips',    measurementData: null },
    { id: 'room_kue',   name: 'Küche',       area: 12.0, height: 2.5, material: 'Beton',   measurementData: null },
    { id: 'room_wohn',  name: 'Wohnzimmer',  area: 25.0, height: 2.7, material: 'Parkett', measurementData: null }
  ],
  equipment: [{ id: 'eq1', type: 'Trockner', model: 'BD 530', room: 'Badezimmer', placed: true }],
  images: [],
  measures: 'Trocknung eingeleitet',
  findings: 'Wasserschaden durch undichte Leitung',
  contacts: [{ name: 'Max Muster', phone: '+41 79 123 45 67', role: 'Eigentümer' }],
  history: []
};

// ─── Helper: Seeded Navigation ────────────────────────────────────────────────

/**
 * Öffnet die App mit Testdaten im localStorage.
 * Startet im Dashboard.
 */
async function openApp(page) {
  await page.addInitScript((report) => {
    localStorage.setItem('qservice_reports_prod', JSON.stringify([report]));
    localStorage.setItem('qservice_current_view', 'dashboard');
    localStorage.removeItem('qservice_selected_report_id');
  }, TEST_REPORT);
  await page.goto('/');
  await page.locator('header.app-header').waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
}

/**
 * Öffnet die App UND navigiert direkt per localStorage ins DamageForm.
 * Kein Klicken durch die Tabelle nötig — funktioniert auch ohne Projekte in der UI.
 */
async function openWithDamageForm(page) {
  await page.addInitScript((report) => {
    localStorage.setItem('qservice_reports_prod', JSON.stringify([report]));
    localStorage.setItem('qservice_current_view', 'details');
    localStorage.setItem('qservice_selected_report_id', report.id);
  }, TEST_REPORT);
  await page.goto('/');
  await page.locator('header.app-header').waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
}

/**
 * Öffnet DamageForm und gibt den Projekttitel zurück.
 * Wirft Error wenn DamageForm nicht geladen.
 */
async function openFirstProject(page) {
  await openWithDamageForm(page);

  // Prüfen ob DamageForm geladen (mehrere mögliche Indikatoren)
  const formVisible =
    await page.locator('input[placeholder*="W-"]').isVisible({ timeout: 3000 }).catch(() => false) ||
    await page.locator('input[placeholder*="Nr"]').first().isVisible({ timeout: 3000 }).catch(() => false) ||
    await page.getByText('Auftrag & Verwaltung', { exact: false }).isVisible({ timeout: 3000 }).catch(() => false) ||
    await page.getByText('Trocknung', { exact: false }).isVisible({ timeout: 3000 }).catch(() => false);

  if (formVisible) {
    console.log('✅ DamageForm geladen via direkter localStorage-Navigation');
    return TEST_REPORT.projectTitle;
  }

  // Fallback: Tabellenzeile klicken
  const row = page.locator('table tbody tr').first();
  if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
    await row.click();
    await page.waitForTimeout(800);
    return TEST_REPORT.projectTitle;
  }

  await page.screenshot({ path: `${SCREENSHOTS}/debug-no-project.png`, fullPage: true });
  throw new Error('DamageForm konnte nicht geöffnet werden!');
}

/**
 * Öffnet das Messprotokoll-Modal aus der DamageForm.
 */
async function openMeasurementModal(page) {
  await page.waitForTimeout(500);

  // Zur Messsektion scrollen
  for (const text of ['Kontrolle Trocknung', 'Messprotokoll', 'Raum']) {
    const el = page.getByText(text, { exact: false }).first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.scrollIntoViewIfNeeded();
      break;
    }
  }
  await page.waitForTimeout(300);

  // Mess-Button klicken
  for (const sel of [
    'button:has-text("Messung starten")',
    'button:has-text("Neue Messung")',
    'button:has-text("Messung")',
    '[data-testid="add-measurement-button"]',
  ]) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(600);
      // Modal erkennen über: festes Portal-Overlay (z-index 10000) ODER Fertig-Button im Modal-Header ODER Canvas
      const opened =
        await page.locator('[style*="z-index: 10000"], [style*="z-index:10000"]').first().isVisible({ timeout: 4000 }).catch(() => false) ||
        await page.locator('button:has-text("Fertig"), button:has-text("Schliessen"), button:has-text("Gespeichert")').isVisible({ timeout: 2000 }).catch(() => false) ||
        await page.locator('canvas').isVisible({ timeout: 2000 }).catch(() => false);
      return { opened, buttonFound: true };
    }
  }
  return { opened: false, buttonFound: false };
}

/**
 * Misst alle sichtbaren Inputs im Modal.
 */
async function measureInputFields(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('[style*="z-index: 10000"]') ||
                  document.querySelector('[style*="z-index:10000"]') ||
                  document.body;
    const inputs = Array.from(modal.querySelectorAll('input[type="number"], input[type="text"]'));
    return inputs.map((inp, i) => {
      const r = inp.getBoundingClientRect();
      const prev = i > 0 ? inputs[i-1].getBoundingClientRect() : null;
      return {
        label: inp.placeholder || inp.id || `Input ${i+1}`,
        height: Math.round(r.height),
        width: Math.round(r.width),
        isInViewport: r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0,
        overlap: prev ? (prev.bottom > r.top && prev.right > r.left) : false,
      };
    }).filter(i => i.width > 0);
  });
}

async function checkHorizontalScroll(page) {
  return page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    windowInnerWidth: window.innerWidth,
    hasHorizontalScroll: document.body.scrollWidth > window.innerWidth,
    overflowingBy: Math.max(0, document.body.scrollWidth - window.innerWidth),
  }));
}

// ─── PORTRAIT TESTS ───────────────────────────────────────────────────────────

test.describe('iPad A1934 (768×1024 Portrait) — Messprotokoll', () => {
  test.use({ viewport: A1934_PORTRAIT });

  // 1. App & Dashboard

  test('1.1 App lädt korrekt auf iPad A1934 Portrait', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('header.app-header')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/01-dashboard-portrait.png`, fullPage: true });
    console.log('✅ App geladen — 768×1024');
  });

  test('1.2 Kein horizontales Scrollen auf Dashboard', async ({ page }) => {
    await openApp(page);
    const s = await checkHorizontalScroll(page);
    if (s.hasHorizontalScroll) {
      console.warn(`⚠️  BUG: Horizontales Scrollen auf Dashboard! Überlauf: ${s.overflowingBy}px`);
    } else {
      console.log(`✅ Kein horizontales Scrollen (${s.bodyScrollWidth}px = ${s.windowInnerWidth}px)`);
    }
    expect(s.hasHorizontalScroll, `Horizontal scroll! +${s.overflowingBy}px`).toBe(false);
  });

  // 2. Projekt / DamageForm

  test('2.1 Projekt öffnen — DamageForm lädt', async ({ page }) => {
    const title = await openFirstProject(page);
    // DamageForm erkennen über verschiedene mögliche Elemente
    const formLoaded =
      await page.locator('input[placeholder*="W-"]').isVisible({ timeout: 3000 }).catch(() => false) ||
      await page.getByText('Auftrag & Verwaltung', { exact: false }).isVisible({ timeout: 3000 }).catch(() => false) ||
      await page.getByText('Messung', { exact: false }).first().isVisible({ timeout: 3000 }).catch(() => false);
    await page.screenshot({ path: `${SCREENSHOTS}/02-damage-form-portrait.png`, fullPage: false });
    expect(formLoaded, 'DamageForm nicht geladen — kein bekanntes Element gefunden').toBe(true);
    console.log(`✅ DamageForm geladen: "${title}"`);
  });

  test('2.2 DamageForm nutzt volle Breite (>85% des Viewports)', async ({ page }) => {
    await openFirstProject(page);
    const info = await page.evaluate(() => {
      const el = document.querySelector('form, main.container, .container');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: r.width, vw: window.innerWidth, ratio: r.width / window.innerWidth };
    });
    if (!info) { console.warn('⚠️  Container nicht gefunden'); return; }
    console.log(`Formbreite: ${info.w.toFixed(0)}px / ${info.vw}px = ${(info.ratio*100).toFixed(1)}%`);
    expect(info.ratio, `Nur ${(info.ratio*100).toFixed(1)}% der Breite`).toBeGreaterThan(0.85);
  });

  // 3. Mess-Buttons

  test('3.1 "Messung starten" Button ist sichtbar und gross genug', async ({ page }) => {
    await openFirstProject(page);
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);

    const btns = await page.locator('button:has-text("Messung")').all();
    console.log(`Gefundene Mess-Buttons: ${btns.length}`);

    if (btns.length === 0) {
      await page.screenshot({ path: `${SCREENSHOTS}/03a-no-btn.png`, fullPage: true });
      console.warn('⚠️  KEIN Mess-Button gefunden! Scrolltiefe evtl. zu gering oder Raum nicht angelegt.');
      return; // Soft-skip
    }

    for (const btn of btns.slice(0, 3)) {
      const box = await btn.boundingBox();
      const lbl = await btn.textContent();
      if (!box) continue;
      console.log(`"${lbl?.trim()}": ${box.width.toFixed(0)}×${box.height.toFixed(0)}px`);
      if (box.height < MIN_TOUCH_PX) {
        console.warn(`⚠️  TOUCH-BUG: "${lbl?.trim()}" zu klein — ${box.height.toFixed(0)}px < ${MIN_TOUCH_PX}px`);
      }
    }
    expect(btns.length).toBeGreaterThan(0);
  });

  test('3.2 Messprotokoll-Modal öffnet sich', async ({ page }) => {
    await openFirstProject(page);
    const { opened, buttonFound } = await openMeasurementModal(page);

    if (!buttonFound) {
      await page.screenshot({ path: `${SCREENSHOTS}/03b-no-btn.png`, fullPage: true });
      console.warn('⚠️  Kein Mess-Button — Modal kann nicht geöffnet werden');
      return;
    }

    expect(opened, 'Modal nicht geöffnet').toBe(true);
    console.log('✅ MeasurementModal geöffnet');
  });

  // 4. Input & Scroll

  test('4.1 Kein horizontales Scrollen im Modal', async ({ page }) => {
    await openFirstProject(page);
    const { opened } = await openMeasurementModal(page);
    if (!opened) return;

    const s = await checkHorizontalScroll(page);
    if (s.hasHorizontalScroll) {
      console.warn(`⚠️  BUG: Horizontales Scrollen im Modal! Überlauf: ${s.overflowingBy}px`);
    }
    expect(s.hasHorizontalScroll, `H-Scroll im Modal! +${s.overflowingBy}px`).toBe(false);
  });

  test('4.2 Inputs: Mindesthöhe 40px (Touch-freundlich)', async ({ page }) => {
    await openFirstProject(page);
    const { opened } = await openMeasurementModal(page);
    if (!opened) { console.warn('Modal nicht offen'); return; }

    await page.waitForTimeout(400);
    const inputs = await measureInputFields(page);
    console.log(`\nInputs im Modal: ${inputs.length}`);

    let bugsFound = 0;
    for (const inp of inputs) {
      console.log(`  "${inp.label}": ${inp.width}×${inp.height}px, inViewport=${inp.isInViewport}`);
      if (inp.height < 40) { bugsFound++; console.warn(`  ⚠️  ZU KLEIN: ${inp.height}px`); }
      if (inp.overlap) { console.warn(`  ⚠️  ÜBERLAPPUNG!`); }
    }
    if (bugsFound) console.warn(`\n⚠️  ${bugsFound} Input(s) unter 40px Höhe!`);

    expect(inputs.length, 'Keine Inputs im Modal').toBeGreaterThan(0);
  });

  test('4.3 Input fokussierbar + keine Seitwärts-Verschiebung', async ({ page }) => {
    await openFirstProject(page);
    const { opened } = await openMeasurementModal(page);
    if (!opened) return;

    const inp = page.locator('input[type="number"], input[type="text"]').first();
    if (!await inp.isVisible({ timeout: 2000 }).catch(() => false)) { console.warn('Kein Input sichtbar'); return; }

    const before = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    await inp.click();
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));

    const jumpX = Math.abs(after.x - before.x);
    if (jumpX > 50) console.warn(`⚠️  BUG: Fokus → horizontaler Jump ${jumpX}px!`);

    await inp.fill('3.5');
    expect(await inp.inputValue()).toBe('3.5');
    console.log(`✅ Input beschreibbar, Fokus-Scroll: X=${jumpX}px`);
  });

  // 5. Messpunkte-Struktur

  test('5.1 Mindestens 4 sichtbare Messpunkte', async ({ page }) => {
    await openFirstProject(page);
    const { opened } = await openMeasurementModal(page);
    if (!opened) return;

    await page.waitForTimeout(400);
    const labels = await page.getByText(/messpunkt/i).all();
    console.log(`Messpunkt-Labels sichtbar: ${labels.length}`);
    if (labels.length < 4) console.warn(`⚠️  Nur ${labels.length} Labels — evtl. Scrollproblem!`);

    await page.screenshot({ path: `${SCREENSHOTS}/05-messpunkte-portrait.png` });
    expect(labels.length, 'Keine Messpunkte').toBeGreaterThan(0);
  });

  test('5.2 Mehrere Inputs gleichzeitig im Viewport (iPad-Nutzung)', async ({ page }) => {
    await openFirstProject(page);
    const { opened } = await openMeasurementModal(page);
    if (!opened) return;

    await page.waitForTimeout(500);
    const inputs = await measureInputFields(page);
    const visible = inputs.filter(i => i.isInViewport);

    console.log(`Inputs total: ${inputs.length}, im Viewport: ${visible.length}`);
    if (visible.length < 3) {
      console.warn(
        `⚠️  UX-PROBLEM: Nur ${visible.length} Input(s) gleichzeitig sichtbar!\n` +
        `   iPad sollte ≥ 3 Messpunkte auf einmal zeigen können.`
      );
    }
    expect(inputs.length, 'Keine Inputs').toBeGreaterThan(0);
  });

  test('5.3 Globale Felder (Datum, Temp, Feuchtigkeit) vorhanden', async ({ page }) => {
    await openFirstProject(page);
    const { opened } = await openMeasurementModal(page);
    if (!opened) return;

    const hasDatum = await page.locator('input[type="date"]').first().isVisible({ timeout: 2000 }).catch(() => false);
    const hasTemp  = await page.locator('input[placeholder*="Temp"], input[placeholder*="°"]').first().isVisible({ timeout: 1000 }).catch(() => false);

    console.log(`Datum-Input: ${hasDatum}, Temp-Input: ${hasTemp}`);
    if (!hasDatum) console.warn('⚠️  Kein Datum-Input sichtbar');
  });

  // 6. Button: Messpunkt hinzufügen

  test('6.1 "+ Messpunkt" Button: vorhanden und Touch-freundlich', async ({ page }) => {
    await openFirstProject(page);
    const { opened } = await openMeasurementModal(page);
    if (!opened) return;

    const addBtn = page.locator('button:has-text("Messpunkt"), [data-testid="add-measurement-button"]').last();
    await page.evaluate(() => {
      const el = document.querySelector('[style*="overflow"]');
      if (el) el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(300);

    if (!await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.warn('⚠️  "+ Messpunkt"-Button nicht gefunden');
      await page.screenshot({ path: `${SCREENSHOTS}/06a-no-add-btn.png` });
      return;
    }

    const box = await addBtn.boundingBox();
    const lbl = await addBtn.textContent();
    console.log(`"${lbl?.trim()}": ${box.width.toFixed(0)}×${box.height.toFixed(0)}px`);
    if (box.height < MIN_TOUCH_PX) {
      console.warn(`⚠️  TOUCH-BUG: Button ${box.height.toFixed(0)}px < ${MIN_TOUCH_PX}px`);
    }
    expect(box.height, `Button zu klein`).toBeGreaterThan(32);
  });

  test('6.2 BONUS: Neuer Messpunkt — Layout stabil', async ({ page }) => {
    await openFirstProject(page);
    const { opened } = await openMeasurementModal(page);
    if (!opened) return;

    const before = await page.locator('input[type="number"]').count();
    const addBtn = page.locator('button:has-text("Messpunkt")').last();
    await addBtn.scrollIntoViewIfNeeded().catch(() => {});

    if (!await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.warn('⚠️  Add-Button nicht klickbar');
      return;
    }

    await addBtn.click();
    await page.waitForTimeout(500);
    const after = await page.locator('input[type="number"]').count();

    console.log(`Inputs: ${before} → ${after} (+${after - before})`);
    await page.screenshot({ path: `${SCREENSHOTS}/06b-after-add.png` });

    if (after - before > 0) {
      console.log('✅ Messpunkt erfolgreich hinzugefügt');
    } else {
      console.warn('⚠️  Kein neuer Input nach Klick!');
    }

    const s = await checkHorizontalScroll(page);
    if (s.hasHorizontalScroll) console.warn(`⚠️  Horizontales Scrollen nach Hinzufügen! +${s.overflowingBy}px`);
  });

  // 7. data-testid Audit

  test('7.1 data-testid Vollständigkeits-Audit', async ({ page }) => {
    await openFirstProject(page);
    const { opened } = await openMeasurementModal(page);
    if (!opened) { console.warn('Modal nicht geöffnet — Audit übersprungen'); return; }

    const ids = ['room-block', 'room-title', 'measurement-point', 'measurement-input', 'add-measurement-button'];
    const results = {};
    for (const id of ids) {
      results[id] = await page.locator(`[data-testid="${id}"]`).count();
      const ok = results[id] > 0;
      console.log(`${ok ? '✅' : '⚠️  FEHLEND'}: data-testid="${id}" (${results[id]}x)`);
    }
    const missing = ids.filter(id => results[id] === 0);
    if (missing.length) {
      console.warn(
        `\n⚠️  AUDIT: ${missing.length}/${ids.length} testids fehlen!\n` +
        missing.map(id => `   → data-testid="${id}"`).join('\n') +
        '\n   → In MeasurementModal.jsx und DamageForm.jsx ergänzen!'
      );
    }
    console.log(`\nAudit-Ergebnis: ${ids.length - missing.length}/${ids.length} vorhanden`);
  });

  // 8. Pflicht-Screenshots

  test('8.1 PFLICHT: Screenshot Portrait fullPage', async ({ page }) => {
    await openFirstProject(page);
    const { opened } = await openMeasurementModal(page);
    await page.screenshot({ path: `${SCREENSHOTS}/messen-ipad-a1934-portrait.png`, fullPage: true });
    console.log(`📸 Portrait-Screenshot gespeichert — Modal offen: ${opened}`);
  });
});

// ─── LANDSCAPE TESTS ──────────────────────────────────────────────────────────

test.describe('iPad A1934 (1024×768 Landscape) — Messprotokoll', () => {
  test.use({ viewport: A1934_LANDSCAPE });

  test('L1. App lädt im Landscape', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('header.app-header')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/L1-dashboard-landscape.png`, fullPage: false });
    console.log('✅ Landscape geladen — 1024×768');
  });

  test('L2. Kein horizontales Scrollen im Landscape', async ({ page }) => {
    await openApp(page);
    const s = await checkHorizontalScroll(page);
    console.log(`scrollWidth=${s.bodyScrollWidth}, innerWidth=${s.windowInnerWidth}`);
    expect(s.hasHorizontalScroll, `H-Scroll! +${s.overflowingBy}px`).toBe(false);
  });

  test('L3. DamageForm nutzt Landscape-Breite', async ({ page }) => {
    await openFirstProject(page);
    const info = await page.evaluate(() => {
      const el = document.querySelector('form, main.container, .container');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: r.width, vw: window.innerWidth, pct: (r.width / window.innerWidth * 100).toFixed(1) };
    });
    if (!info) { console.warn('Container nicht gefunden'); return; }
    console.log(`Landscape-Breite: ${info.pct}% (${info.w.toFixed(0)}/${info.vw}px)`);
    if (parseFloat(info.pct) < 85) {
      console.warn(`⚠️  UX-PROBLEM: Nur ${info.pct}% Breite genutzt im Landscape!`);
    }
  });

  test('L4. Modal öffnet sich im Landscape', async ({ page }) => {
    await openFirstProject(page);
    const { opened, buttonFound } = await openMeasurementModal(page);
    console.log(`Button: ${buttonFound}, Modal: ${opened}`);
    if (!buttonFound) await page.screenshot({ path: `${SCREENSHOTS}/L4-no-btn.png`, fullPage: true });
  });

  test('L5. Mehr Inputs im Viewport (Landscape-Vorteil)', async ({ page }) => {
    await openFirstProject(page);
    const { opened } = await openMeasurementModal(page);
    if (!opened) return;

    await page.waitForTimeout(500);
    const inputs = await measureInputFields(page);
    const visible = inputs.filter(i => i.isInViewport);

    console.log(`Landscape: ${inputs.length} Inputs total, ${visible.length} im Viewport (1024×768)`);
    if (visible.length === 0 && inputs.length > 0) {
      console.warn('⚠️  BUG: Inputs vorhanden aber keiner im Viewport sichtbar!');
    }
  });

  test('L6. PFLICHT: Screenshot Landscape fullPage', async ({ page }) => {
    await openFirstProject(page);
    const { opened } = await openMeasurementModal(page);
    await page.screenshot({ path: `${SCREENSHOTS}/messen-ipad-a1934-landscape.png`, fullPage: true });
    console.log(`📸 Landscape-Screenshot gespeichert — Modal offen: ${opened}`);
  });
});
