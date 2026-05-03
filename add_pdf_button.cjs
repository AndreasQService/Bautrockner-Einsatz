const fs = require('fs');
let content = fs.readFileSync('src/components/DamageForm.jsx', 'utf8');

const replacement = `                                                            <button
                                                                type="button"
                                                                title="Skizze als PDF speichern"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        const { ExportService } = await import('../services/ExportService');
                                                                        await ExportService.generateSketchPdf(formData, room, entry);
                                                                    } catch(err) {
                                                                        alert('Fehler beim PDF Export: ' + err.message);
                                                                    }
                                                                }}
                                                                style={{ position: 'absolute', top: '6px', right: '44px', background: 'rgba(59,130,246,0.85)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', zIndex: 10 }}
                                                            >
                                                                <Download size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                title="Bild löschen"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!window.confirm('Dieses Messprotokoll-Bild wirklich löschen?')) return;`;

content = content.replace(/\s*<button\s*type="button"\s*title="Bild löschen"\s*onClick=\{\(\) => \{\s*if \(!window\.confirm\('Dieses Messprotokoll-Bild wirklich löschen\?'\)\) return;/, '\n' + replacement);

fs.writeFileSync('src/components/DamageForm.jsx', content);
console.log('Added PDF export button to DamageForm.jsx');
