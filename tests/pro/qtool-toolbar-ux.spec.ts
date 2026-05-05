import { test, expect } from '@playwright/test';

test.describe('QTool Pro: Toolbar & Canvas UX Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await page.waitForLoadState('networkidle');
    
    // Ensure Technician Mode is active for iPad-like audit
    const toggleBtn = page.locator('button[title="Zwischen Desktop- und Techniker-Modus wechseln"]');
    if (await toggleBtn.isVisible()) {
      const btnText = (await toggleBtn.innerText()).trim();
      if (btnText === 'Desktop') {
        await toggleBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('1. Toolbar Audit: Measurement & Sketching', async ({ page, viewport }) => {
    // 1. Open first project
    const projectCard = page.locator('.tech-project-card, .card').first();
    await projectCard.click();
    
    // 2. Open Measurements / Sketching area
    const measBtn = page.locator('button:has-text("Messung"), button:has-text("Messungen")').first();
    await measBtn.click();
    
    // 3. Audit Toolbar Buttons (in Modal or Fullscreen)
    const toolbarButtons = page.locator('button:visible');
    const buttonCount = await toolbarButtons.count();
    
    console.log(`Auditing ${buttonCount} visible buttons...`);
    
    for (let i = 0; i < buttonCount; i++) {
        const btn = toolbarButtons.nth(i);
        const box = await btn.boundingBox();
        if (box) {
            // HIG Check: iPad min 44px
            const isIpad = viewport?.width && viewport.width >= 768 && viewport.width <= 1366;
            const minHeight = isIpad ? 44 : 36;
            
            if (box.height < minHeight) {
                console.warn(`P2: Button too small (${box.height}px < ${minHeight}px)`);
            }
        }
    }
    
    // 4. Visual Check: Active/Disabled States
    await expect(page).toHaveScreenshot('toolbar-states.png');
  });

  test('2. Canvas Audit: Grid & Alignment', async ({ page }) => {
    // 1. Open first project
    const projectCard = page.locator('.tech-project-card, .card').first();
    await expect(projectCard).toBeVisible({ timeout: 10000 });
    await projectCard.click();
    
    // 2. Navigate to Sketching (if separate or in measurements)
    const measBtn = page.locator('button:has-text("Messung")').first();
    await measBtn.click();
    
    // 3. Look for Canvas / Grid
    const canvas = page.locator('canvas').first();
    if (await canvas.isVisible()) {
        await expect(canvas).toBeVisible();
        
        // Screenshot for Grid Contrast Check
        await expect(page).toHaveScreenshot('canvas-grid-audit.png');
        
        // Check for empty space above/below canvas
        const box = await canvas.boundingBox();
        if (box && box.y < 100) {
            // Toolbar overlap check?
        }
    }
  });

  test('3. Button Consistency: Color & Contrast', async ({ page }) => {
    // 1. Open first project - using a more resilient selector
    const projectCard = page.locator('.tech-project-card, .card').first();
    await expect(projectCard).toBeVisible({ timeout: 10000 });
    await projectCard.click();
    
    const photoTab = page.locator('button:has-text("Fotos")').first();
    if (await photoTab.isVisible()) {
        await photoTab.click();
    }
    
    // Verify toolbar group logic
    const toolbar = page.locator('div[style*="display: flex"]').filter({ has: page.locator('button') }).first();
    await expect(toolbar).toBeVisible();
    
    await expect(page).toHaveScreenshot('toolbar-consistency.png');
  });
});
