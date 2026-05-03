const fs = require('fs');
let content = fs.readFileSync('src/services/ExportService.js', 'utf8');

const newFunc = `
    /**
     * Generates a simple PDF for a sketch
     * @param {Object} formData 
     * @param {Object} room 
     * @param {Object} entry 
     */
    ,
    generateSketchPdf: async (formData, room, entry) => {
        return new Promise((resolve, reject) => {
            try {
                const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = doc.internal.pageSize.getHeight();

                // 1. Kopfzeile
                doc.setFontSize(16);
                doc.setTextColor(30, 41, 59);
                doc.text(\`Skizze: \${room.name || 'Unbekannter Raum'}\`, 15, 20);

                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                const projectNum = formData.projectNumber || formData.id || '-';
                const address = [formData.street, [formData.zip, formData.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Keine Adresse';
                const dateStr = new Date().toLocaleDateString('de-DE');
                
                doc.text(\`Projekt: \${projectNum}\`, 15, 28);
                doc.text(\`Adresse: \${address}\`, 15, 33);
                doc.text(\`Datum: \${dateStr}\`, pdfWidth - 15, 28, { align: 'right' });
                doc.text(\`Bezeichnung: \${entry.label || '-'}\`, pdfWidth - 15, 33, { align: 'right' });

                doc.setDrawColor(226, 232, 240);
                doc.line(15, 38, pdfWidth - 15, 38);

                // 2. Hauptteil (Skizze)
                const marginX = 15;
                const startY = 45;
                const maxImgWidth = pdfWidth - marginX * 2;
                const maxImgHeight = pdfHeight - startY - 15;

                const img = new Image();
                img.onload = () => {
                    const imgAspect = img.width / img.height;
                    const pdfAspect = maxImgWidth / maxImgHeight;

                    let renderWidth, renderHeight;
                    if (imgAspect > pdfAspect) {
                        renderWidth = maxImgWidth;
                        renderHeight = maxImgWidth / imgAspect;
                    } else {
                        renderHeight = maxImgHeight;
                        renderWidth = maxImgHeight * imgAspect;
                    }

                    const xPos = marginX + (maxImgWidth - renderWidth) / 2;
                    const yPos = startY + (maxImgHeight - renderHeight) / 2;

                    // Zeichne das Bild
                    doc.addImage(entry.src, 'PNG', xPos, yPos, renderWidth, renderHeight);

                    // Speichere das PDF
                    doc.save(\`Skizze_\${room.name || 'Raum'}_\${dateStr}.pdf\`);
                    resolve();
                };
                img.onerror = reject;
                img.src = entry.src;
            } catch (error) {
                console.error('Error generating sketch PDF:', error);
                reject(error);
            }
        });
    }
};`;

content = content.replace(/};\s*$/, newFunc);
fs.writeFileSync('src/services/ExportService.js', content);
console.log('Added generateSketchPdf to ExportService');
