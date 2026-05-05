import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function generatePDF() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Read the markdown documentation
  const docPath = 'C:\\Users\\Andreas Q-Service\\.gemini\\antigravity\\brain\\9ca2b62f-929f-458d-a32b-fc8f00948d39\\system_documentation.md';
  let markdown = fs.readFileSync(docPath, 'utf8');

  // 1. Extract Mermaid blocks to protect them from global replacements
  const mermaidBlocks = [];
  markdown = markdown.replace(/```mermaid([\s\S]*?)```/g, (match, content) => {
    const id = `MERMAID_BLOCK_${mermaidBlocks.length}`;
    mermaidBlocks.push(content.trim());
    return id;
  });

  // 2. Perform global replacements on the remaining text
  let htmlBody = markdown
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/\n/g, '<br/>')
    .replace(/---/g, '<hr/>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  // 3. Re-insert Mermaid blocks into safe divs
  mermaidBlocks.forEach((content, i) => {
    htmlBody = htmlBody.replace(`MERMAID_BLOCK_${i}`, `<div class="mermaid">${content}</div>`);
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js"></script>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; padding: 40px; max-width: 900px; margin: auto; background: #fff; }
        h1 { color: #1E3A8A; border-bottom: 2px solid #1E3A8A; padding-bottom: 10px; font-size: 28px; }
        h2 { color: #1E40AF; margin-top: 30px; border-bottom: 1px solid #E5E7EB; padding-bottom: 5px; font-size: 22px; }
        h3 { color: #1E3A8A; margin-top: 20px; font-size: 18px; }
        hr { border: none; border-top: 1px solid #D1D5DB; margin: 30px 0; }
        code { background: #F3F4F6; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
        pre { background: #F9FAFB; padding: 15px; border-radius: 8px; border: 1px solid #E5E7EB; overflow-x: auto; font-size: 13px; }
        .mermaid { display: flex; justify-content: center; margin: 30px 0; background: #fff; padding: 10px; border-radius: 8px; min-height: 100px; }
        .footer { margin-top: 50px; font-size: 12px; color: #6B7280; text-align: center; }
        @media print {
          body { padding: 0; }
          .page-break { page-break-before: always; }
          .mermaid svg { max-width: 100% !important; height: auto !important; }
        }
      </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 60px;">
        <h1 style="border: none; font-size: 36px; margin-bottom: 10px;">QTool Systemdokumentation</h1>
        <p style="font-size: 18px; color: #4B5563;">Version 5.1 - Graphical Edition</p>
        <p style="font-size: 14px; color: #9CA3AF;">Datum: ${new Date().toLocaleDateString('de-DE')}</p>
      </div>

      ${htmlBody}

      <div class="footer">
        © 2026 QTool - Andreas Q-Service. Generiert von Antigravity Code-Agent.
      </div>
      
      <script>
        async function runMermaid() {
          try {
            mermaid.initialize({ startOnLoad: false, theme: 'default' });
            await mermaid.run();
            window.mermaidRendered = true;
          } catch (e) {
            console.error('Mermaid error:', e);
            window.mermaidRendered = true; // Still allow PDF gen
          }
        }
        runMermaid();
      </script>
    </body>
    </html>
  `;

  await page.setContent(htmlContent);
  
  // Wait for Mermaid to finish rendering
  try {
    await page.waitForFunction(() => window.mermaidRendered === true, { timeout: 15000 });
    await page.waitForTimeout(2000); // Give it a moment to settle
  } catch (e) {
    console.warn('Warning: Mermaid rendering timed out, proceeding with PDF generation anyway.');
  }

  const pdfPath = 'C:\\QTool\\artifacts\\QTool_Systemdokumentation_v5.pdf';
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size: 8px; width: 100%; text-align: right; padding-right: 20mm; color: #999;">QTool Systemdokumentation v5.1</div>',
    footerTemplate: '<div style="font-size: 8px; width: 100%; text-align: center; color: #999;">Seite <span class="pageNumber"></span> von <span class="totalPages"></span></div>',
  });

  console.log('PDF erfolgreich erstellt:', pdfPath);
  await browser.close();
}

generatePDF().catch(console.error);
