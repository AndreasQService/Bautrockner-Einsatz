const fs = require('fs');
let content = fs.readFileSync('src/components/MeasurementModal.jsx', 'utf8');

const pdfBtn = `                                <button onClick={async () => {
                                    if (!previewSnapshot) return alert('Keine Skizze vorhanden.');
                                    try {
                                        const { ExportService } = await import('../services/ExportService');
                                        const dummyData = { projectNumber: projectTitle, street: address, zip: '', city: '' };
                                        const rName = globalSettings?.room || initialData?.name || 'Unbekannt';
                                        await ExportService.generateSketchPdf(dummyData, { name: rName }, { src: previewSnapshot, label: 'Messprotokoll-Skizze' });
                                    } catch(err) {
                                        alert('Fehler beim PDF Export: ' + err.message);
                                    }
                                }} style={{ padding: '0.5rem 1.1rem', borderRadius: 8, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#34D399', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', minHeight: 36, marginLeft: '0.5rem' }}>
                                    <Download size={15} /> PDF Export
                                </button>
                            </div>`;

content = content.replace(/<Edit3 size=\{15\} \/> Skizze bearbeiten\s*<\/button>\s*<\/div>/, '<Edit3 size={15} /> Skizze bearbeiten\n                                </button>\n' + pdfBtn);

fs.writeFileSync('src/components/MeasurementModal.jsx', content);
console.log('Added PDF export button to MeasurementModal.jsx');
