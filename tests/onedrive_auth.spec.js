import { test, expect } from '@playwright/test';

test.describe('OneDrive Auth Stability', () => {
  test('should handle multiple login clicks without interaction_in_progress error', async ({ page }) => {
    await page.goto('http://localhost:5174/');
    
    // Wir warten, bis die App geladen ist
    const loginBtn = page.locator('#onedrive-connect-btn');
    
    // Falls der User bereits eingeloggt ist (aus vorherigen Tests), überspringen wir das
    if (await loginBtn.isVisible()) {
      // Simuliere schnellen Doppelklick
      await loginBtn.click();
      await loginBtn.click();
      
      // Prüfen, dass keine rote MSAL-Fehlermeldung eingeblendet wird
      // MSAL Fehlertexte enthalten oft 'interaction_in_progress'
      const errorMsg = page.locator('text=interaction_in_progress');
      await expect(errorMsg).not.toBeVisible();
    }
  });
});
