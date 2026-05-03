const fs = require('fs');
let content = fs.readFileSync('src/components/DamageForm.jsx', 'utf8');

content = content.replace(
    /background: 'var\(--surface\)', border: '2px solid var\(--q-primary\)',\s*borderRadius: '16px', padding: '2\.5rem 1rem', cursor: 'pointer',\s*display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',\s*gap: '0\.75rem', boxShadow: '0 4px 20px rgba\(30, 109, 183, 0\.15\)', minHeight: '130px', transition: 'transform 0\.15s'/g,
    "background: 'var(--surface)', border: `2px solid ${tile.color}`,\n                            borderRadius: '16px', padding: '2.5rem 1rem', cursor: 'pointer',\n                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',\n                            gap: '0.75rem', boxShadow: `0 4px 20px ${tile.color}33`, minHeight: '130px', transition: 'transform 0.15s'"
);

content = content.replace(
    /background: 'var\(--surface\)', border: '2px solid var\(--q-primary\)',\s*borderRadius: '16px', padding: '2\.5rem 1rem', cursor: 'pointer',\s*display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',\s*gap: '0\.75rem', boxShadow: '0 4px 20px rgba\(30, 109, 183, 0\.15\)',\s*width: 'calc\(50% - 0\.5rem\)', minHeight: '130px'/g,
    "background: 'var(--surface)', border: `2px solid ${TECH_TILES[4].color}`,\n                        borderRadius: '16px', padding: '2.5rem 1rem', cursor: 'pointer',\n                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',\n                        gap: '0.75rem', boxShadow: `0 4px 20px ${TECH_TILES[4].color}33`,\n                        width: 'calc(50% - 0.5rem)', minHeight: '130px'"
);

fs.writeFileSync('src/components/DamageForm.jsx', content);
console.log('Fixed tiles colors');
