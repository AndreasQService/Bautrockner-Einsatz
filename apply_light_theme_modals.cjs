const fs = require('fs');

const files = [
    'src/components/UploadPanel.jsx',
    'src/components/EmailImportModal.jsx',
    'src/components/EmailImportModalV2.jsx',
    'src/components/ImageEditor.jsx',
    'src/components/TechnicianModeView.jsx'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    content = content.replace(/backgroundColor:\s*'#0F172A'/ig, "backgroundColor: '#F8FAFC'");
    content = content.replace(/backgroundColor:\s*'#1E293B'/ig, "backgroundColor: '#FFFFFF'");
    content = content.replace(/background:\s*'#0F172A'/ig, "background: '#F8FAFC'");
    content = content.replace(/background:\s*'#1E293B'/ig, "background: '#FFFFFF'");

    content = content.replace(/color:\s*'white'/ig, "color: '#1E293B'");
    content = content.replace(/color:\s*'#F1F5F9'/ig, "color: '#1E293B'");
    content = content.replace(/color:\s*'#E2E8F0'/ig, "color: '#1E293B'");
    
    // Fix borders
    content = content.replace(/border:\s*'1px solid rgba\(255,255,255,0\.1\)'/g, "border: '1px solid #E2E8F0', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'");
    content = content.replace(/borderTop:\s*'1px solid rgba\(255,255,255,0\.1\)'/g, "borderTop: '1px solid #E2E8F0'");
    content = content.replace(/borderBottom:\s*'1px solid rgba\(255,255,255,0\.1\)'/g, "borderBottom: '1px solid #E2E8F0'");

    fs.writeFileSync(file, content);
    console.log(`${file} updated successfully.`);
}
