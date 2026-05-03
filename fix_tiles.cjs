const fs = require('fs');
let content = fs.readFileSync('src/components/DamageForm.jsx', 'utf8');

// Replace the tile container background
content = content.replace(
    /backgroundColor: '#F8FAFC', padding: '2rem 1.25rem 3rem', fontFamily: 'Inter,system-ui,sans-serif', color: '#1E293B'/g,
    "backgroundColor: '#0F172A', padding: '2rem 1.25rem 3rem', fontFamily: 'Inter,system-ui,sans-serif', color: '#F1F5F9'"
);

// First 4 tiles
const tilesRegex = /\{TECH_TILES\.slice\(0, 4\)\.map\(tile => \([\s\S]*?\}\)\}/;
const oldTiles = `{TECH_TILES.slice(0, 4).map(tile => (
                        <button key={tile.id} onClick={() => { 
                            if (tile.status) setFormData(prev => ({ ...prev, status: tile.status })); 
                            
                            if (tile.id === 'trocknung') {
                                setTechRoomSelectorMode('geraete');
                                setShowTechRoomSelector(true);
                            } else {
                                setTechTab(tile.id); 
                            }
                        }} style={{
                            background: '#1E293B', border: \`2px solid \${tile.color}\`,
                            borderRadius: '16px', padding: '2.5rem 1rem', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: '0.75rem', boxShadow: \`0 4px 20px \${tile.glow}\`, minHeight: '130px', transition: 'transform 0.15s'
                        }}>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9' }}>{tile.label === 'Trocknung' ? 'Geräte' : tile.label}</span>
                        </button>
                    ))}`;
content = content.replace(tilesRegex, oldTiles);

// 5th tile
const fifthTileRegex = /<button onClick=\{\(\) => \{\s*if \(TECH_TILES\[4\]\.status\).*?\s*setTechRoomSelectorMode\('messung'\);\s*setShowTechRoomSelector\(true\);\s*\}\} style=\{\{[\s\S]*?\}\}>\s*<span[\s\S]*?<\/span>\s*<\/button>/;
const oldFifthTile = `<button onClick={() => {
                        if (TECH_TILES[4].status) setFormData(prev => ({ ...prev, status: TECH_TILES[4].status }));
                        setTechRoomSelectorMode('messung');
                        setShowTechRoomSelector(true);
                    }} style={{
                        background: '#1E293B', border: \`2px solid \${TECH_TILES[4].color}\`,
                        borderRadius: '16px', padding: '2.5rem 1rem', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: '0.75rem', boxShadow: \`0 4px 20px \${TECH_TILES[4].glow}\`,
                        width: 'calc(50% - 0.5rem)', minHeight: '130px'
                    }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#F1F5F9' }}>{TECH_TILES[4].label}</span>
                    </button>`;
content = content.replace(fifthTileRegex, oldFifthTile);

// The modal inside the technician screen
content = content.replace(
    /backgroundColor: 'rgba\(255,255,255,0\.85\)', zIndex: 9999/g,
    "backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999"
);
content = content.replace(
    /backgroundColor: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '1\.5rem', color: '#1E293B', border: '1px solid #E2E8F0', boxShadow: '0 10px 25px rgba\(0,0,0,0\.05\)'/g,
    "backgroundColor: '#1E293B', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '1.5rem', color: '#F1F5F9', border: '1px solid rgba(255,255,255,0.1)'"
);
content = content.replace(
    /borderTop: '1px solid #E2E8F0', paddingTop: '1\.5rem', display: 'flex'/g,
    "borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', display: 'flex'"
);
content = content.replace(
    /padding: '1\.25rem 1rem', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#1E293B'/g,
    "padding: '1.25rem 1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#F1F5F9'"
);
content = content.replace(
    /padding: '1rem', borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', boxShadow: '0 4px 6px -1px rgba\(0,0,0,0\.05\)', color: '#1E293B'/g,
    "padding: '1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#F1F5F9'"
);
content = content.replace(
    /width: '100%', background: '#FFFFFF', color: '#1E293B', border: '1px dashed #94A3B8'/g,
    "width: '100%', background: 'rgba(255,255,255,0.02)', color: '#F1F5F9', border: '1px dashed rgba(255,255,255,0.2)'"
);

fs.writeFileSync('src/components/DamageForm.jsx', content);
console.log('Fixed tiles in DamageForm.jsx');
