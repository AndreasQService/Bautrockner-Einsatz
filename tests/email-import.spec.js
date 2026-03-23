import { test, expect } from '@playwright/test';

const MOCK_JSON = JSON.stringify({
  auftraggeber: {
    firma: "Neukom Marzolo AG", name: "Nikola Komani", rolle: "Handw.",
    telefon: "+41 79 886 84 71", email: "nikola.komani@neukom-marzolo.ch",
    strasse_nr: "Gewerbestrasse 13", plz: "8197", ort: "Rafz"
  },
  verwaltung: { firma: "", name: "", rolle: "Verw.", telefon: "", email: "" },
  mieter: [{ name: "Murtaz Nazeek Zavahir", wohnung: "B1804", telefon: "+41 79 881 36 74", email: "nazeek@gmail.com" }],
  eigentuemer: { firma: "", name: "Tobias Crettenand", rolle: "Eig.", telefon: "+41 79 527 14 45", email: "wolkenwerkb1804@gmail.com" },
  hauswart: { firma: "", name: "", rolle: "HW", telefon: "", email: "" },
  handwerker: [],
  schadenort: { bezeichnung: "B1804 Penthouse, 18./19. Stockwerk", strasse_nr: "Leutschenbachstrasse 30", plz: "8050", ort: "Zürich" },
  schaden: { art: "Wasserschaden", beschreibung: "Wassereintritt, Trocknung erforderlich." }
});

async function setupMocks(page) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();

    // Gemini Model-Discovery mocken
    if (url.includes('generativelanguage.googleapis.com') && url.includes('/models?')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [{ name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] }]
        })
      });
      return;
    }

    // Gemini generateContent mocken
    if (url.includes('generativelanguage.googleapis.com') && url.includes('generateContent')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{ content: { parts: [{ text: MOCK_JSON }], role: 'model' }, finishReason: 'STOP' }]
        })
      });
      return;
    }

    // Nominatim Geocoding mocken
    if (url.includes('nominatim.openstreetmap.org')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ address: { postcode: '8050', city: 'Zürich' } }])
      });
      return;
    }

    // Alles andere normal weiterlaufen lassen
    await route.continue();
  });
}

async function runImport(page) {
  // Mocks VOR dem Laden setzen
  await setupMocks(page);
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1500);

  // Neuer Auftrag
  await page.getByRole('button', { name: /Neuer Auftrag/i }).click();
  await page.waitForTimeout(1000);

  // Textarea React-kompatibel füllen
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 10000 });
  await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (!ta) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, 'Neukom Marzolo Test Email');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(500);

  // Analyse starten
  const analyzeBtn = page.getByRole('button', { name: /Text analysieren/i });
  await analyzeBtn.waitFor({ state: 'visible', timeout: 5000 });
  await analyzeBtn.click();

  // Warte auf Erfolg-Status
  await expect(page.locator('span').filter({ hasText: /Analyse bereit/i })).toBeVisible({ timeout: 15000 });

  // Daten übernehmen
  await page.getByRole('button', { name: /Daten übernehmen/i }).click();
  await page.waitForTimeout(1500);
}

test.beforeEach(async ({ page }) => {
  await runImport(page);
});

test('Schadenort: Strasse übernommen', async ({ page }) => {
  const val = await page.locator('input[placeholder*="Strasse"]').first().inputValue();
  console.log('✅ Strasse:', val);
  expect(val).toMatch(/Leutschenbachstrasse/i);
});

test('Schadenort: PLZ übernommen', async ({ page }) => {
  const val = await page.locator('input[placeholder="PLZ"]').first().inputValue();
  console.log('✅ PLZ:', val);
  expect(val).toBe('8050');
});

test('Schadenort: Ort übernommen', async ({ page }) => {
  const val = await page.locator('input[placeholder="Ort"]').first().inputValue();
  console.log('✅ Ort:', val);
  expect(val).toMatch(/Zürich/i);
});

test('Auftraggeber erkannt', async ({ page }) => {
  // Suche nach Neukom Marzolo in einem Input
  const inputs = page.locator('input');
  const count = await inputs.count();
  let found = false;
  for (let i = 0; i < count; i++) {
    const val = await inputs.nth(i).inputValue();
    if (/Neukom Marzolo/i.test(val)) { found = true; console.log('✅ Auftraggeber:', val); break; }
  }
  expect(found).toBe(true);
});

test('Mieter importiert', async ({ page }) => {
  await expect(page.getByText(/Murtaz Nazeek Zavahir/i)).toBeVisible({ timeout: 5000 });
  console.log('✅ Mieter: Murtaz Nazeek Zavahir gefunden');
});
