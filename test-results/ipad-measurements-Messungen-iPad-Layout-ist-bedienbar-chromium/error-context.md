# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ipad-measurements.spec.js >> Messungen iPad Layout ist bedienbar
- Location: tests\ipad-measurements.spec.js:33:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('tbody tr').first()

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - img "QService" [ref=e8]
        - generic [ref=e9]: Q-Service AG
      - navigation [ref=e10]:
        - button "Techniker" [ref=e11] [cursor=pointer]
        - button "Hell" [ref=e12] [cursor=pointer]:
          - img [ref=e13]
          - generic [ref=e19]: Hell
        - generic [ref=e20]:
          - generic [ref=e21]:
            - generic [ref=e22]: Admin User
            - generic [ref=e23]: admin
          - button "Abmelden" [ref=e24] [cursor=pointer]:
            - img [ref=e25]
  - main [ref=e28]:
    - generic [ref=e29]:
      - generic [ref=e30]: "❌ Supabase Fehler: 57014: canceling statement due to statement timeout"
      - button "✕" [ref=e31] [cursor=pointer]
    - generic [ref=e32]:
      - generic [ref=e33]:
        - generic [ref=e34]:
          - heading "Dashboard" [level=2] [ref=e35]
          - generic [ref=e36]:
            - button "Aktuell" [ref=e37]
            - button "Archiv" [ref=e38]
        - generic [ref=e39]:
          - textbox "Suche (Name, Adresse, Gerät...)" [ref=e40]
          - img [ref=e41]
      - generic [ref=e45]: 0 Projekte gefunden
```

# Test source

```ts
  1  | import { test, expect, devices } from '@playwright/test';
  2  | 
  3  | test.use({
  4  |   ...devices['iPad Pro 11'],
  5  |   permissions: [],
  6  | });
  7  | 
  8  | async function navigateToMeasurementModal(page) {
  9  |   await page.goto('http://localhost:5173');
  10 | 
  11 |   // 1. Switch to Technician Mode
  12 |   await page.getByTitle('Zwischen Desktop- und Techniker-Modus wechseln').click();
  13 | 
  14 |   // 2. Select the first project in the list
> 15 |   await page.locator('tbody tr').first().click();
     |                                          ^ Error: locator.click: Test timeout of 30000ms exceeded.
  16 | 
  17 |   // 3. Open the "Messung" tile
  18 |   await page.getByText('Messung', { exact: true }).click();
  19 | 
  20 |   // 4. Open a measurement modal (existing room or new one)
  21 |   const roomLink = page.getByText('Wohnzimmer').first();
  22 |   const newRoomBtn = page.getByText('Neuer Raum / Neue Messung').first();
  23 | 
  24 |   // Using a short timeout to check which one is visible
  25 |   try {
  26 |     await expect(roomLink).toBeVisible({ timeout: 2000 });
  27 |     await roomLink.click();
  28 |   } catch (e) {
  29 |     await newRoomBtn.click();
  30 |   }
  31 | }
  32 | 
  33 | test('Messungen iPad Layout ist bedienbar', async ({ page }) => {
  34 |   await navigateToMeasurementModal(page);
  35 | 
  36 |   // Hauptbereiche sichtbar
  37 |   await expect(page.getByText('Skizze').first()).toBeVisible();
  38 |   
  39 |   // Buttons sichtbar im Modal
  40 |   await expect(page.getByRole('button', { name: /Kacheln/i })).toBeVisible();
  41 |   
  42 |   // Wand/Boden Inputs sichtbar
  43 |   const inputs = page.locator('[data-testid^="measurement-input"]');
  44 |   await expect(inputs.first()).toBeVisible();
  45 | });
  46 | 
  47 | test('Messwertfelder haben iPad-taugliche Attribute', async ({ page }) => {
  48 |   await navigateToMeasurementModal(page);
  49 | 
  50 |   const inputs = page.locator('[data-testid^="measurement-input"]');
  51 |   await expect(inputs.first()).toBeVisible();
  52 | 
  53 |   const count = await inputs.count();
  54 |   for (let i = 0; i < count; i++) {
  55 |     const input = inputs.nth(i);
  56 |     await expect(input).toHaveAttribute('type', 'text');
  57 |     await expect(input).toHaveAttribute('inputmode', /numeric|decimal/);
  58 |     await expect(input).toHaveAttribute('autocomplete', 'off');
  59 |   }
  60 | });
  61 | 
  62 | test('Enter springt zum nächsten Messfeld', async ({ page }) => {
  63 |   await navigateToMeasurementModal(page);
  64 | 
  65 |   const inputs = page.locator('[data-testid^="measurement-input"]');
  66 |   await expect(inputs.nth(0)).toBeVisible();
  67 | 
  68 |   await inputs.nth(0).click();
  69 |   await inputs.nth(0).fill('123');
  70 |   await page.keyboard.press('Enter');
  71 | 
  72 |   await expect(inputs.nth(1)).toBeFocused();
  73 | });
  74 | 
```