import { test, expect, devices } from '@playwright/test';

test.use({
  ...devices['iPad Pro 11'],
  permissions: [],
});

async function navigateToMeasurementModal(page) {
  await page.goto('http://localhost:5173');

  // 1. Switch to Technician Mode
  await page.getByTitle('Zwischen Desktop- und Techniker-Modus wechseln').click();

  // 2. Select the first project in the list
  await page.locator('tbody tr').first().click();

  // 3. Open the "Messung" tile
  await page.getByText('Messung', { exact: true }).click();

  // 4. Open a measurement modal (existing room or new one)
  const roomLink = page.getByText('Wohnzimmer').first();
  const newRoomBtn = page.getByText('Neuer Raum / Neue Messung').first();

  // Using a short timeout to check which one is visible
  try {
    await expect(roomLink).toBeVisible({ timeout: 2000 });
    await roomLink.click();
  } catch (e) {
    await newRoomBtn.click();
  }
}

test('Messungen iPad Layout ist bedienbar', async ({ page }) => {
  await navigateToMeasurementModal(page);

  // Hauptbereiche sichtbar
  await expect(page.getByText('Skizze').first()).toBeVisible();
  
  // Buttons sichtbar im Modal
  await expect(page.getByRole('button', { name: /Kacheln/i })).toBeVisible();
  
  // Wand/Boden Inputs sichtbar
  const inputs = page.locator('[data-testid^="measurement-input"]');
  await expect(inputs.first()).toBeVisible();
});

test('Messwertfelder haben iPad-taugliche Attribute', async ({ page }) => {
  await navigateToMeasurementModal(page);

  const inputs = page.locator('[data-testid^="measurement-input"]');
  await expect(inputs.first()).toBeVisible();

  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).toHaveAttribute('inputmode', /numeric|decimal/);
    await expect(input).toHaveAttribute('autocomplete', 'off');
  }
});

test('Enter springt zum nächsten Messfeld', async ({ page }) => {
  await navigateToMeasurementModal(page);

  const inputs = page.locator('[data-testid^="measurement-input"]');
  await expect(inputs.nth(0)).toBeVisible();

  await inputs.nth(0).click();
  await inputs.nth(0).fill('123');
  await page.keyboard.press('Enter');

  await expect(inputs.nth(1)).toBeFocused();
});
