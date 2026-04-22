/**
 * QTool Desktop UI Audit – Playwright Script
 * Ausführen: node qtool-audit.cjs
 * Voraussetzung: npm install playwright (einmalig)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'audit-results');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const VIEWPORTS = [
  { width: 1600, height: 900,  name: '1600x900' },
  { width: 1920, height: 1080, name: '1920x1080' },
];

const URL = 'http://localhost:5174/';

// ── Kontrast-Berechnung (WCAG 2.2 AA) ─────────────────────────────────
function luminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function parseRGB(color) {
  const m = color.match(/\d+/g);
  return m ? [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])] : [0, 0, 0];
}
function contrastRatio(fg, bg) {
  const [r1, g1, b1] = parseRGB(fg);
  const [r2, g2, b2] = parseRGB(bg);
  const L1 = luminance(r1, g1, b1);
  const L2 = luminance(r2, g2, b2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
}

async function runAudit() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  QTool Desktop Light Mode UI Audit               ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // ── 1. Seite laden ─────────────────────────────────────────────────
  console.log('► Lade QTool...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000); // Supabase-Daten laden lassen

  // ── 2. Light Mode aktivieren ──────────────────────────────────────
  const theme = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme')
  );
  console.log(`► Aktueller Theme: ${theme}`);
  if (theme === 'dark') {
    const toggleBtn = await page.$('#dark-mode-toggle');
    if (toggleBtn) {
      await toggleBtn.click();
      await page.waitForTimeout(800);
      console.log('► Light Mode aktiviert');
    }
  }

  const report = {
    meta: { url: URL, date: new Date().toISOString() },
    theme: {},
    computedStyles: {},
    typography: [],
    contrast: [],
    buttons: [],
    wcagIssues: [],
    screenshots: [],
  };

  // ── 3. Screenshots + DOM für jedes Viewport ───────────────────────
  for (const vp of VIEWPORTS) {
    console.log(`\n► Viewport: ${vp.name}`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(500);

    // Screenshot oben
    const topFile = path.join(OUT_DIR, `dashboard-light-${vp.name}-top.png`);
    await page.screenshot({ path: topFile, fullPage: false });
    report.screenshots.push(topFile);
    console.log(`  📸 ${path.basename(topFile)}`);

    // Scrolled Screenshot (Workflow-Übersicht)
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    const midFile = path.join(OUT_DIR, `dashboard-light-${vp.name}-scroll.png`);
    await page.screenshot({ path: midFile, fullPage: false });
    report.screenshots.push(midFile);
    console.log(`  📸 ${path.basename(midFile)}`);

    // Zurück nach oben
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
  }

  // Reset zu 1600x900 für DOM-Analyse
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.waitForTimeout(300);

  // ── 4. Computed Styles auslesen ────────────────────────────────────
  console.log('\n► Lese Computed Styles...');
  const styles = await page.evaluate(() => {
    const get = (sel, prop) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : 'NOT FOUND';
    };
    const getH = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.offsetHeight + 'px' : 'NOT FOUND';
    };

    return {
      body_fontFamily:         get('body', 'fontFamily'),
      body_fontSize:           get('body', 'fontSize'),
      body_color:              get('body', 'color'),
      body_backgroundColor:    get('body', 'backgroundColor'),
      header_backgroundColor:  get('header', 'backgroundColor'),
      header_height:           getH('header'),
      header_borderBottom:     get('header', 'borderBottom'),
      btnPrimary_bg:           get('.btn-primary', 'backgroundColor'),
      btnPrimary_color:        get('.btn-primary', 'color'),
      btnPrimary_fontSize:     get('.btn-primary', 'fontSize'),
      btnPrimary_height:       getH('.btn-primary'),
      btnPrimary_radius:       get('.btn-primary', 'borderRadius'),
      btnOutline_bg:           get('.btn-outline', 'backgroundColor'),
      btnOutline_border:       get('.btn-outline', 'borderColor'),
      btnOutline_color:        get('.btn-outline', 'color'),
      btnOutline_height:       getH('.btn-outline'),
      btnGhost_color:          get('.btn-ghost', 'color'),
      th_backgroundColor:      get('.data-table th', 'backgroundColor'),
      th_color:                get('.data-table th', 'color'),
      th_fontSize:             get('.data-table th', 'fontSize'),
      th_fontWeight:           get('.data-table th', 'fontWeight'),
      th_padding:              get('.data-table th', 'padding'),
      td_color:                get('.data-table td', 'color'),
      td_fontSize:             get('.data-table td', 'fontSize'),
      td_fontWeight:           get('.data-table td', 'fontWeight'),
      td_padding:              get('.data-table td', 'padding'),
      card_backgroundColor:    get('.card', 'backgroundColor'),
      card_borderColor:        get('.card', 'borderColor'),
      card_borderRadius:       get('.card', 'borderRadius'),
      card_padding:            get('.card', 'padding'),
    };
  });
  report.computedStyles = styles;

  // ── 5. Kleine Schriften finden (<12px) ────────────────────────────
  console.log('► Suche kleine Texte (<12px)...');
  const smallFonts = await page.evaluate(() => {
    const issues = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0 && el.textContent.trim().length > 2) {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs > 0 && fs < 12) {
          issues.push({
            tag: el.tagName,
            class: el.className.toString().slice(0, 30),
            text: el.textContent.trim().slice(0, 25),
            fontSize: fs + 'px',
          });
        }
      }
    });
    return issues.slice(0, 20);
  });
  report.typography = smallFonts;

  // ── 6. Button-Grössen prüfen (<32px Höhe) ─────────────────────────
  console.log('► Prüfe Button-Höhen...');
  const buttonIssues = await page.evaluate(() => {
    const issues = [];
    document.querySelectorAll('button').forEach(btn => {
      const h = btn.offsetHeight;
      const w = btn.offsetWidth;
      if (h > 0 && h < 32) {
        issues.push({
          text: (btn.textContent || btn.title || 'icon').trim().slice(0, 20),
          height: h + 'px',
          width: w + 'px',
          wcag: h < 24 ? 'CRITICAL' : 'WARNING',
        });
      }
    });
    return issues.slice(0, 15);
  });
  report.buttons = buttonIssues;

  // ── 7. WCAG Kontrast-Prüfung ───────────────────────────────────────
  console.log('► Prüfe WCAG Kontraste...');
  const contrastChecks = await page.evaluate(() => {
    const checks = [];
    const elements = [
      { sel: '.data-table th', label: 'Tabellenkopf' },
      { sel: '.data-table td', label: 'Tabellenzelle' },
      { sel: '.btn-primary', label: 'Primärbutton' },
      { sel: '.btn-outline', label: 'Sekundärbutton' },
      { sel: 'body', label: 'Body Text' },
      { sel: '.section-header', label: 'Section Header' },
      { sel: '.card', label: 'Card Text' },
    ];
    elements.forEach(({ sel, label }) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const cs = getComputedStyle(el);
      checks.push({
        element: label,
        selector: sel,
        color: cs.color,
        background: cs.backgroundColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
      });
    });
    return checks;
  });

  // Kontrast berechnen
  report.contrast = contrastChecks.map(c => {
    const ratio = contrastRatio(c.color, c.background);
    const fs = parseFloat(c.fontSize);
    const isLarge = fs >= 18 || (fs >= 14 && parseInt(c.fontWeight) >= 700);
    const required = isLarge ? 3.0 : 4.5;
    const passes = parseFloat(ratio) >= required;
    return {
      ...c,
      contrastRatio: ratio + ':1',
      required: required + ':1',
      wcagAA: passes ? '✅ PASS' : '❌ FAIL',
    };
  });

  // ── 8. Vollständiger Screenshot (1600x900) ─────────────────────────
  await page.evaluate(() => window.scrollTo(0, 0));
  const fullFile = path.join(OUT_DIR, 'dashboard-light-full-1600.png');
  await page.screenshot({ path: fullFile, fullPage: true });
  report.screenshots.push(fullFile);
  console.log(`  📸 ${path.basename(fullFile)} (fullpage)`);

  // Workflow-Screenshot (nach unten scrollen bis Workflow sichtbar)
  const workflowVisible = await page.evaluate(() => {
    const el = document.querySelector('[class*="workflow"], [class*="Workflow"]');
    if (el) { el.scrollIntoView(); return true; }
    return false;
  });
  if (workflowVisible) {
    await page.waitForTimeout(300);
    const wfFile = path.join(OUT_DIR, 'workflow-light-1600.png');
    await page.screenshot({ path: wfFile });
    report.screenshots.push(wfFile);
    console.log(`  📸 ${path.basename(wfFile)}`);
  }

  // ── 9. Report ausgeben ─────────────────────────────────────────────
  await browser.close();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  AUDIT ERGEBNISSE                                ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Computed Styles
  console.log('── COMPUTED STYLES ───────────────────────────────────');
  Object.entries(styles).forEach(([k, v]) => {
    const flag = (k.includes('height') && v !== 'NOT FOUND' && parseInt(v) < 32) ? ' ⚠️' :
                 (k.includes('fontSize') && v !== 'NOT FOUND' && parseFloat(v) < 12) ? ' ⚠️ SMALL' : '';
    console.log(`  ${k.padEnd(28)}: ${v}${flag}`);
  });

  // Typography Issues
  console.log('\n── KLEINE TEXTE (<12px) ─────────────────────────────');
  if (smallFonts.length === 0) {
    console.log('  ✅ Keine Texte unter 12px gefunden');
  } else {
    smallFonts.forEach(f => console.log(`  ⚠️  ${f.fontSize} | ${f.tag}.${f.class} | "${f.text}"`));
  }

  // Button Issues
  console.log('\n── BUTTONS <32px HÖHE ────────────────────────────────');
  if (buttonIssues.length === 0) {
    console.log('  ✅ Alle Buttons ≥32px');
  } else {
    buttonIssues.forEach(b => console.log(`  ${b.wcag === 'CRITICAL' ? '🔴' : '🟡'} ${b.height} | "${b.text}"`));
  }

  // Kontrast
  console.log('\n── WCAG 2.2 AA KONTRAST ──────────────────────────────');
  report.contrast.forEach(c => {
    console.log(`  ${c.wcagAA} ${c.element.padEnd(20)} Ratio: ${c.contrastRatio} (min ${c.required}) | fg:${c.color} bg:${c.background}`);
  });

  // Screenshots
  console.log('\n── SCREENSHOTS ───────────────────────────────────────');
  report.screenshots.forEach(s => console.log(`  📷 ${s}`));

  // JSON-Report speichern
  const reportFile = path.join(OUT_DIR, 'audit-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n✅ JSON-Report gespeichert: ${reportFile}`);
  console.log('\n► Audit abgeschlossen.\n');
}

runAudit().catch(err => {
  console.error('Audit Fehler:', err.message);
  process.exit(1);
});
