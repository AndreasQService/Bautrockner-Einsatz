const fs = require('fs');

function replaceFile(path, replacements) {
    let content = fs.readFileSync(path, 'utf8');
    for (const [regex, replacement] of replacements) {
        content = content.replace(regex, replacement);
    }
    fs.writeFileSync(path, content);
}

replaceFile('src/components/TechnicianModeView.jsx', [
    [/background: '#FFFFFF'/g, "background: '#1E293B'"],
    [/backgroundColor: '#F8FAFC'/g, "backgroundColor: '#0F172A'"],
    [/backgroundColor: '#FFFFFF'/g, "backgroundColor: '#1E293B'"],
    [/background: '#F8FAFC'/g, "background: '#0F172A'"]
]);

replaceFile('src/components/MeasurementModal.jsx', [
    [/backgroundColor: '#FFFFFF'/g, "backgroundColor: '#1E293B'"],
    [/backgroundColor: '#F8FAFC'/g, "backgroundColor: '#0F172A'"],
    [/background: '#FFFFFF'/g, "background: '#1E293B'"],
    [/background: '#F8FAFC'/g, "background: '#0F172A'"]
]);

console.log("Fixed TechnicianModeView.jsx and MeasurementModal.jsx");
