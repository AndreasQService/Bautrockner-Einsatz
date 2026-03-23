import { test, expect } from '@playwright/test';

// Diagnose-Test: Zeigt was Playwright wirklich sieht
test('Diagnose: Was sieht Playwright beim Start?', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000);
  
  // Screenshot
  await page.screenshot({ path: 'tests/screenshots/start.png', fullPage: false });
  
  // Was ist auf der Seite?
  const title = await page.title();
  const allButtons = await page.locator('button').allTextContents();
  const allInputs = await page.locator('input').count();
  
  console.log('Seitentitel:', title);
  console.log('Buttons:', allButtons.slice(0, 10));
  console.log('Inputs:', allInputs);
  
  // Ist ein Login-Screen sichtbar?
  const loginVisible = await page.getByText(/login|anmelden|sign in/i).isVisible().catch(() => false);
  const dashboardVisible = await page.getByText(/Dashboard/i).isVisible().catch(() => false);
  const neuerAuftragVisible = await page.getByRole('button', { name: /Neuer Auftrag/i }).isVisible().catch(() => false);
  
  console.log('Login sichtbar:', loginVisible);
  console.log('Dashboard sichtbar:', dashboardVisible);
  console.log('Neuer Auftrag Button:', neuerAuftragVisible);
  
  // Test läuft immer durch - wir wollen nur die Diagnose-Info
  expect(title).toBeDefined();
});
