const fs = require('fs');
let content = fs.readFileSync('src/components/MeasurementModal.jsx', 'utf8');

const regex = /<div style=\{\{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0\.75rem', color: '#94A3B8' \}\}>\s*<div style=\{\{ width: '75%', maxWidth: 380, height: 200, backgroundImage: 'linear-gradient\(to right,rgba\(255,255,255,0\.05\) 1px,transparent 1px\),linear-gradient\(to bottom,rgba\(255,255,255,0\.05\) 1px,transparent 1px\)', backgroundSize: '40px 40px', backgroundColor: 'var\(--surface\)', borderRadius: 8, border: '1px solid var\(--border\)' \}\} \/>\s*<span style=\{\{ fontSize: '0\.85rem' \}\}>Noch keine Skizze vorhanden<\/span>\s*<\/div>/;

const target = `<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: '#64748B' }}>
                                    <div style={{ width: '75%', maxWidth: 380, height: 200, backgroundImage: 'linear-gradient(to right,rgba(0,0,0,0.05) 1px,transparent 1px),linear-gradient(to bottom,rgba(0,0,0,0.05) 1px,transparent 1px)', backgroundSize: '40px 40px', backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Noch keine Skizze vorhanden</span>
                                </div>`;

if (regex.test(content)) {
    content = content.replace(regex, target);
    fs.writeFileSync('src/components/MeasurementModal.jsx', content);
    console.log('Fixed placeholder');
} else {
    console.log('Regex did not match');
}
