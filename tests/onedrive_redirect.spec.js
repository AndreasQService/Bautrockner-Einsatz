import { test, expect } from '@playwright/test';

test.describe('OneDrive Auth Redirect', () => {
  test('should trigger redirect on login click', async ({ page }) => {
    await page.goto('http://localhost:5174/');
    
    const loginBtn = page.locator('#onedrive-connect-btn');
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
      
      // Prüfen, ob die URL nun auf die Microsoft Login Seite zeigt (Redirect)
      // Wir warten einen Moment auf den URL-Wechsel
      await page.waitForURL(/login\.microsoftonline\.com/);
      expect(page.url()).toContain('login.microsoftonline.com');
    }
  });
});
