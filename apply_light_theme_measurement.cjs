const fs = require('fs');

let content = fs.readFileSync('src/components/MeasurementModal.jsx', 'utf8');

// Replace dark colors with light theme colors
content = content.replace(
    /backgroundColor:\s*'#0F172A'/g,
    "backgroundColor: '#F8FAFC'"
);
content = content.replace(
    /backgroundColor:\s*'#1E293B'/g,
    "backgroundColor: '#FFFFFF'"
);
content = content.replace(
    /backgroundColor:\s*'#111827'/g,
    "backgroundColor: '#FFFFFF'"
);
content = content.replace(
    /backgroundColor:\s*'rgba\(15,23,42,0\.95\)'/g,
    "backgroundColor: 'rgba(255,255,255,0.95)'"
);

// Borders
content = content.replace(
    /border:\s*'1px solid rgba\(255,255,255,0\.1\)'/g,
    "border: '1px solid #E2E8F0', boxShadow: '0 30px 80px rgba(0,0,0,0.1)'"
);
content = content.replace(
    /borderTop:\s*'1px solid rgba\(255,255,255,0\.08\)'/g,
    "borderTop: '1px solid #E2E8F0'"
);
content = content.replace(
    /borderBottom:\s*'1px solid rgba\(255,255,255,0\.08\)'/g,
    "borderBottom: '1px solid #E2E8F0'"
);
content = content.replace(
    /borderBottom:\s*'1px solid rgba\(255,255,255,0\.1\)'/g,
    "borderBottom: '1px solid #E2E8F0'"
);
content = content.replace(
    /borderBottom:\s*'1px solid rgba\(255,255,255,0\.07\)'/g,
    "borderBottom: '1px solid #E2E8F0'"
);

// Text colors
content = content.replace(
    /color:\s*'#F1F5F9'/g,
    "color: '#1E293B'"
);
content = content.replace(
    /color:\s*'var\(--text-muted\)'/g,
    "color: '#64748B'"
);

// Modal Backdrop
content = content.replace(
    /backgroundColor:\s*'rgba\(0,0,0,0\.85\)'/g,
    "backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)'"
);

fs.writeFileSync('src/components/MeasurementModal.jsx', content);
console.log('MeasurementModal.jsx updated successfully.');
