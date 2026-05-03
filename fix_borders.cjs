const fs = require('fs');
const files = [
  'src/components/MeasurementModal.jsx',
  'src/components/DamageForm.jsx',
  'src/components/ImageEditor.jsx',
  'src/components/UploadPanel.jsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let c = fs.readFileSync(file, 'utf8');
    c = c.replace(/#E2E8F0/gi, 'var(--border)');
    c = c.replace(/#CBD5E1/gi, 'var(--border)');
    // Also let's double check if there are any #e0e0e0 that are used for borders.
    c = c.replace(/border:\s*'1px solid #dde1e7'/gi, "border: '1px solid var(--border)'");
    c = c.replace(/border:\s*'1px solid #e0e0e0'/gi, "border: '1px solid var(--border)'");
    
    fs.writeFileSync(file, c);
  }
});
