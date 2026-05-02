const fs = require('fs');

let content = fs.readFileSync('src/components/DamageForm.jsx', 'utf8');

// Fix the tile backgrounds
content = content.replace(
    /background:\s*'#1E293B'/g,
    "background: '#FFFFFF'"
);
content = content.replace(
    /backgroundColor:\s*'#1E293B'/g,
    "backgroundColor: '#FFFFFF'"
);
content = content.replace(
    /background:\s*'#0F172A'/g,
    "background: '#F8FAFC'"
);
content = content.replace(
    /backgroundColor:\s*'#0F172A'/g,
    "backgroundColor: '#F8FAFC'"
);

// Fix the PDF stuff that was broken or dark
content = content.replace(
    /background:\s*'linear-gradient\(135deg, #0F172A 0%, #1E293B 100%\)'/g,
    "background: '#FFFFFF'"
);
// Make the QR code modal background light
content = content.replace(
    /backgroundColor:\s*'rgba\(0,0,0,0\.85\)'/g,
    "backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)'"
);

// Fix the top header in Technician Mode
content = content.replace(
    /backgroundColor:\s*'var\(--surface\)'/g,
    "backgroundColor: '#FFFFFF'"
);

// Look for 'white' or '#fff' inside buttons where we want them to remain white, but my previous script made them '#1E293B'.
// Wait, I replaced `color: 'white'` with `color: '#1E293B'`. This made icons black.
content = content.replace(
    /color:\s*'#1E293B',\s*border:\s*'none',\s*borderRadius:\s*'50%'/g,
    "color: 'white', border: 'none', borderRadius: '50%'"
);
content = content.replace(
    /color:\s*'#1E293B',\s*fontSize:\s*'0\.65rem'/g,
    "color: 'white', fontSize: '0.65rem'"
);
content = content.replace(
    /color:\s*'#1E293B',\s*minHeight:\s*'36px'/g,
    "color: 'white', minHeight: '36px'"
);

// Fix the sticky bottom navigation in Technician Mode
content = content.replace(
    /backgroundColor:\s*'var\(--surface\)'(.*?)(borderTop.*?)/g,
    "backgroundColor: '#FFFFFF'$1$2"
);

// Change text color from #F1F5F9 to #1E293B globally in DamageForm if it's there
content = content.replace(
    /color:\s*'#F1F5F9'/g,
    "color: '#1E293B'"
);
content = content.replace(
    /color:\s*'var\(--text-main\)'/g,
    "color: '#1E293B'"
);
content = content.replace(
    /color:\s*'var\(--text-muted\)'/g,
    "color: '#64748B'"
);
content = content.replace(
    /border:\s*'1px solid var\(--border\)'/g,
    "border: '1px solid #E2E8F0'"
);
content = content.replace(
    /borderBottom:\s*'1px solid var\(--border\)'/g,
    "borderBottom: '1px solid #E2E8F0'"
);

fs.writeFileSync('src/components/DamageForm.jsx', content);
console.log('DamageForm.jsx updated successfully.');
