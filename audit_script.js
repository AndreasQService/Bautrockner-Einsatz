import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('AI_REPORTS');
const screenDir = path.resolve(outDir, 'screenshots/light-mode-audit');

if (!fs.existsSync(screenDir)) {
    fs.mkdirSync(screenDir, { recursive: true });
}

// Helpers
function relativePath(p) {
    return path.relative(process.cwd(), p).replace(/\\/g, '/');
}

// WCAG Contrast calc
function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(l1, l2) {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

// In-browser evaluation function
const evaluatePage = () => {
    const findings = [];
    
    function parseColor(c) {
        if (!c) return null;
        const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
        if (!m) return null;
        return {
            r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]), a: m[4] ? parseFloat(m[4]) : 1
        };
    }
    
    function getEffectiveBackground(el) {
        let current = el;
        while (current) {
            const style = window.getComputedStyle(current);
            const bg = style.backgroundColor;
            const parsed = parseColor(bg);
            if (parsed && parsed.a > 0.1) return parsed;
            current = current.parentElement;
        }
        return {r: 255, g: 255, b: 255, a: 1}; // Default white
    }

    function getLuminance(r, g, b) {
        const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function getContrastRatio(l1, l2) {
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }
    
    function rgbToHex({r, g, b}) {
        return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
    }

    const elements = document.querySelectorAll('input, textarea, select, button, [role="button"], [class*="btn"], [class*="button"]');
    
    elements.forEach(el => {
        if (!el.offsetParent) return; // not visible
        const style = window.getComputedStyle(el);
        const color = parseColor(style.color);
        const bg = getEffectiveBackground(el);
        
        if (color && bg) {
            const l1 = getLuminance(color.r, color.g, color.b);
            const l2 = getLuminance(bg.r, bg.g, bg.b);
            const ratio = getContrastRatio(l1, l2);
            
            const fontSize = parseFloat(style.fontSize);
            const isLargeText = fontSize >= 18 || (fontSize >= 14 && style.fontWeight >= 700);
            const required = isLargeText ? 3.0 : 4.5;
            
            if (ratio < required) {
                let severity = 'medium';
                if (ratio < 1.5) severity = 'critical';
                
                let issue = 'Low contrast';
                if (ratio < 1.5 && getLuminance(color.r, color.g, color.b) > 0.8) issue = 'White text on white/light background';
                if (ratio < 1.5 && getLuminance(color.r, color.g, color.b) < 0.2) issue = 'Black text on dark background';
                
                let rect = el.getBoundingClientRect();
                
                findings.push({
                    tagName: el.tagName,
                    id: el.id || '',
                    className: typeof el.className === 'string' ? el.className : '',
                    text: (el.innerText || el.value || el.placeholder || '').substring(0, 30).replace(/\n/g, ' '),
                    textColor: rgbToHex(color),
                    bgColor: rgbToHex(bg),
                    ratio: ratio.toFixed(2),
                    required: required,
                    severity: severity,
                    issue: issue,
                    width: rect.width,
                    height: rect.height
                });
            }
        }
    });
    
    return findings;
};

async function run() {
    const browser = await chromium.launch({ headless: true });
    
    const viewports = [
        { name: 'Desktop_1440x900', width: 1440, height: 900 },
        { name: 'iPad_Landscape_1024x768', width: 1024, height: 768 },
        { name: 'iPad_Portrait_768x1024', width: 768, height: 1024 }
    ];
    
    let allFindings = [];
    let screenshotCount = 0;
    
    for (const vp of viewports) {
        console.log(`Testing viewport: ${vp.name}`);
        const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: 1
        });
        const page = await context.newPage();
        
        async function captureAndEval(sectionName) {
            await page.waitForTimeout(1000); // Wait for animations
            const screenPath = path.join(screenDir, `${vp.name}_${sectionName}.png`);
            await page.screenshot({ path: screenPath, fullPage: true });
            screenshotCount++;
            
            const finds = await page.evaluate(evaluatePage);
            finds.forEach(f => {
                f.viewport = vp.name;
                f.section = sectionName;
                f.screenshot = relativePath(screenPath);
                allFindings.push(f);
            });
            console.log(`  - ${sectionName}: found ${finds.length} issues`);
        }
        
        try {
            await page.goto('http://localhost:5173');
            await page.waitForTimeout(2000);
            
            // Login
            const adminBtn = page.locator('text="Admin User"').first();
            if (await adminBtn.isVisible()) {
                await adminBtn.click();
                await page.waitForTimeout(1500);
            }
            
            // Set to Light Mode if needed (click Sun icon)
            const sunIcon = page.locator('.lucide-sun').first();
            if (await sunIcon.isVisible()) {
                await sunIcon.click();
                await page.waitForTimeout(500);
            }
            
            await captureAndEval('Dashboard');
            
            // Click first project
            const projectRow = page.locator('table tbody tr').first();
            if (await projectRow.isVisible()) {
                await projectRow.click();
                await captureAndEval('ProjektDetails');
                
                // Navigate tabs
                const tabs = ['Räume / Fotos', 'Messen', 'Skizze', 'Workflow'];
                for (const tab of tabs) {
                    const tabBtn = page.locator(`button:has-text("${tab}")`).first();
                    if (await tabBtn.isVisible()) {
                        await tabBtn.click();
                        await captureAndEval(tab.replace(/[^a-zA-Z]/g, ''));
                        
                        // If "Messen", try to open a room
                        if (tab === 'Messen') {
                            const openBtn = page.locator('button:has-text("Öffnen")').first();
                            if (await openBtn.isVisible()) {
                                await openBtn.click();
                                await captureAndEval('Messen_Raum_Offen');
                            }
                        }
                    }
                }
            }
            
            // Techniker Mode
            await page.goto('http://localhost:5173');
            await page.waitForTimeout(1500);
            const techBtn = page.locator('text="Techniker-Modus"').first();
            if (await techBtn.isVisible()) {
                await techBtn.click();
                await captureAndEval('Dashboard_Techniker');
                
                const projTech = page.locator('div.project-card, tr').first();
                if (await projTech.isVisible()) {
                    await projTech.click();
                    await captureAndEval('ProjektDetails_Techniker');
                }
            }
            
        } catch (e) {
            console.error(`Error in ${vp.name}:`, e.message);
        }
        await context.close();
    }
    
    await browser.close();
    
    // Generate Report
    console.log("Generating report...");
    
    // De-duplicate findings based on section, text, and classes
    const uniqueFindingsMap = new Map();
    allFindings.forEach(f => {
        const key = `${f.section}_${f.tagName}_${f.className}_${f.text}`;
        if (!uniqueFindingsMap.has(key)) {
            uniqueFindingsMap.set(key, f);
        }
    });
    
    const uniqueFindings = Array.from(uniqueFindingsMap.values());
    
    const critical = uniqueFindings.filter(f => f.severity === 'critical');
    const medium = uniqueFindings.filter(f => f.severity === 'medium');
    
    let md = `# QTool UI Contrast Audit Report (Light Mode)\n\n`;
    md += `## Final Summary\n`;
    md += `- **Pages/States Tested**: ~10 per viewport\n`;
    md += `- **Screenshots Captured**: ${screenshotCount}\n`;
    md += `- **Critical Findings**: ${critical.length}\n`;
    md += `- **Medium Findings**: ${medium.length}\n`;
    md += `- **Cosmetic Findings**: 0 (script focused on WCAG failures)\n\n`;
    
    md += `## Critical Findings (White-on-White / Black-on-Dark)\n\n`;
    critical.forEach((f, i) => {
        md += `### ${i+1}. [${f.section}] ${f.tagName} Element\n`;
        md += `- **Text**: "${f.text}"\n`;
        md += `- **DOM Class**: \`${f.className}\`\n`;
        md += `- **Viewport**: ${f.viewport}\n`;
        md += `- **Screenshot**: [Link](${f.screenshot})\n`;
        md += `- **Text Color**: ${f.textColor}\n`;
        md += `- **Background Color**: ${f.bgColor}\n`;
        md += `- **Ratio**: ${f.ratio}:1 (Required: ${f.required}:1)\n`;
        md += `- **Severity**: CRITICAL (${f.issue})\n`;
        md += `- **Guideline**: WCAG 2.2 Contrast, Apple HIG\n`;
        md += `- **Recommended Fix**: Adjust colors to ensure at least ${f.required}:1 contrast.\n\n`;
    });
    
    md += `## Medium Findings (Low Contrast)\n\n`;
    md += `| Section | Element/Text | Text Color | Bg Color | Ratio | Required |\n`;
    md += `|---------|--------------|------------|----------|-------|----------|\n`;
    medium.forEach(f => {
        md += `| ${f.section} | ${f.tagName} ("${f.text.substring(0,15)}") | ${f.textColor} | ${f.bgColor} | ${f.ratio} | ${f.required} |\n`;
    });
    
    const reportPath = path.join(outDir, 'QTOOL_DEEP_UI_AUDIT_LIGHT_MODE.md');
    fs.writeFileSync(reportPath, md);
    console.log(`Report written to ${reportPath}`);
}

run().catch(console.error);
