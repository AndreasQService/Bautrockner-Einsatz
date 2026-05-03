const fs = require('fs');

function replaceFile(path, replacements) {
    let content = fs.readFileSync(path, 'utf8');
    for (const [regex, replacement] of replacements) {
        content = content.replace(regex, replacement);
    }
    fs.writeFileSync(path, content);
}

replaceFile('src/components/DamageForm.jsx', [
    [/background: mode === 'technician' \? 'var\(--surface\)' : undefined/g, "background: mode === 'technician' ? 'rgba(59,130,246,0.12)' : undefined"],
    [/background: mode === 'technician' \? 'var\(--background\)' : 'rgba\\(255,255,255,0\.05\\)'/g, "background: mode === 'technician' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)'"],
    [/backgroundColor: mode === 'technician' \? 'var\(--background\)' : 'var\(--text-main\)'/g, "backgroundColor: mode === 'technician' ? '#0F172A' : 'var(--text-main)'"],
    [/borderTop: mode === 'technician' \? '1px solid var\(--border\)' : '1px solid #0F172A'/g, "borderTop: mode === 'technician' ? '1px solid #334155' : '1px solid #0F172A'"],
    [/color: mode === 'technician' \? 'var\(--text-main\)' : 'var\(--primary\)'/g, "color: mode === 'technician' ? '#F1F5F9' : 'var(--primary)'"],
    [/color: mode === 'technician' \? 'var\(--text-muted\)' : 'var\(--primary\)'/g, "color: mode === 'technician' ? '#94A3B8' : 'var(--primary)'"]
]);

replaceFile('src/components/TechnicianModeView.jsx', [
    [/background:'var\(--surface\)'/g, "background:'#1E293B'"],
    [/backgroundColor: 'var\(--background\)'/g, "backgroundColor: '#0F172A'"]
]);

replaceFile('src/components/MeasurementModal.jsx', [
    [/backgroundColor: 'var\(--surface\)'/g, "backgroundColor: '#1E293B'"],
    [/backgroundColor: 'var\(--background\)'/g, "backgroundColor: '#0F172A'"],
    [/backgroundColor:'var\(--surface\)'/g, "backgroundColor:'#1E293B'"],
    [/backgroundColor:'var\(--background\)'/g, "backgroundColor:'#0F172A'"],
    [/background: 'var\(--color-panel-bg\)'/g, "background: '#0F172A'"],
    [/var\(--color-panel-bg\)/g, "'#0F172A'"]
]);
