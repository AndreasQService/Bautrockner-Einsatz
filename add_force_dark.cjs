const fs = require('fs');
let content = fs.readFileSync('src/components/DamageForm.jsx', 'utf8');

// 1. Add force-dark-mode to Kachel-Home
content = content.replace(
    /<div style=\{\{ minHeight: '100vh', backgroundColor: 'var\(--background\)', padding: '2rem 1\.25rem 3rem', fontFamily: 'Inter,system-ui,sans-serif', color: 'var\(--text-main\)' \}\}>/g,
    "<div className=\"force-dark-mode\" style={{ minHeight: '100vh', backgroundColor: 'var(--background)', padding: '2rem 1.25rem 3rem', fontFamily: 'Inter,system-ui,sans-serif', color: 'var(--text-main)' }}>"
);

// 2. Add force-dark-mode to Tab content wrapper
content = content.replace(
    /<div style=\{\{ backgroundColor: 'var\(--background\)', minHeight: '100vh', paddingBottom: '80px', color: 'var\(--text-main\)', fontFamily: 'Inter,system-ui,sans-serif' \}\}>/g,
    "<div className=\"force-dark-mode\" style={{ backgroundColor: 'var(--background)', minHeight: '100vh', paddingBottom: '80px', color: 'var(--text-main)', fontFamily: 'Inter,system-ui,sans-serif' }}>"
);

fs.writeFileSync('src/components/DamageForm.jsx', content);
console.log('Added force-dark-mode class to technician containers');
