const fs = require('fs');

let content = fs.readFileSync('src/components/DamageForm.jsx', 'utf8');

// 1. Main Background
content = content.replace(
    /backgroundColor:\s*'#0F172A'/g,
    "backgroundColor: '#F8FAFC'"
);
// Replace main text color
content = content.replace(
    /color:\s*'#F1F5F9'/g,
    "color: '#1E293B'"
);
content = content.replace(
    /color:\s*'white'/g,
    "color: '#1E293B'"
);

// 2. Modals and Inner Cards
content = content.replace(
    /backgroundColor:\s*'#1E293B'/g,
    "backgroundColor: '#FFFFFF'"
);
content = content.replace(
    /border:\s*'1px solid rgba\(255,255,255,0\.1\)'/g,
    "border: '1px solid #E2E8F0', boxShadow: '0 10px 25px rgba(0,0,0,0.05)'"
);
content = content.replace(
    /border:\s*'1px solid rgba\(255,255,255,0\.15\)'/g,
    "border: '1px solid #E2E8F0', boxShadow: '0 10px 25px rgba(0,0,0,0.05)'"
);
content = content.replace(
    /borderTop:\s*'1px solid rgba\(255,255,255,0\.1\)'/g,
    "borderTop: '1px solid #E2E8F0', boxShadow: '0 -4px 20px rgba(0,0,0,0.04)'"
);
content = content.replace(
    /background:\s*'rgba\(255,255,255,0\.02\)'/g,
    "background: '#FFFFFF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)'"
);
content = content.replace(
    /background:\s*'rgba\(255,255,255,0\.03\)'/g,
    "background: '#F1F5F9'"
);
content = content.replace(
    /background:\s*'rgba\(255,255,255,0\.05\)'/g,
    "background: '#E2E8F0'"
);
content = content.replace(
    /background:\s*'rgba\(255,255,255,0\.1\)'/g,
    "background: '#CBD5E1'"
);
content = content.replace(
    /backgroundColor:\s*'rgba\(255,255,255,0\.02\)'/g,
    "backgroundColor: '#FFFFFF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)'"
);
content = content.replace(
    /backgroundColor:\s*'rgba\(255,255,255,0\.03\)'/g,
    "backgroundColor: '#F1F5F9'"
);
content = content.replace(
    /border:\s*'1px solid var\(--border\)'/g,
    "border: '1px solid #E2E8F0'"
);
content = content.replace(
    /borderBottom:\s*'1px solid var\(--border\)'/g,
    "borderBottom: '1px solid #E2E8F0'"
);

// 3. Tile borders
content = content.replace(
    /border:\s*`2px solid \${tile\.color}`/g,
    "border: '1px solid #E2E8F0', borderLeft: `4px solid ${tile.color}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'"
);
content = content.replace(
    /border:\s*`2px solid \${TECH_TILES\[4\]\.color}`/g,
    "border: '1px solid #E2E8F0', borderLeft: `4px solid ${TECH_TILES[4].color}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'"
);

// Fix the PDF export colors which might have been accidentally changed:
content = content.replace(
    /backgroundColor: '#F8FAFC',\s*color: '#1E293B',\s*padding: '0.5rem 1rem',\s*fontSize: '14pt',\s*borderRadius: '4px',\s*marginBottom: '1.5rem'/g,
    "backgroundColor: '#0F172A', color: 'white', padding: '0.5rem 1rem', fontSize: '14pt', borderRadius: '4px', marginBottom: '1.5rem'"
);
content = content.replace(
    /color: '#1E293B'\s*}\}>Q-Service AG/g,
    "color: '#0F172A' }}>Q-Service AG"
);
content = content.replace(
    /color: '#1E293B'\s*}\}>Schadensbericht/g,
    "color: '#0F172A' }}>Schadensbericht"
);


fs.writeFileSync('src/components/DamageForm.jsx', content);
console.log('DamageForm.jsx updated successfully.');
