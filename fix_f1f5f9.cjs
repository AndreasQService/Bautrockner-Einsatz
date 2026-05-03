const fs = require('fs');

const files = [
  'src/components/MeasurementModal.jsx',
  'src/components/DamageForm.jsx',
  'src/components/ImageEditor.jsx',
  'src/components/UploadPanel.jsx',
  'src/components/Dashboard.jsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let c = fs.readFileSync(file, 'utf8');
    
    // Replace light colors with CSS variables
    c = c.replace(/#F1F5F9/gi, 'var(--background)');
    c = c.replace(/#F8FAFC/gi, 'var(--background)');
    
    fs.writeFileSync(file, c);
  }
});
