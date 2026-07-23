import fs from 'fs';

const content = fs.readFileSync('c:/QTool_Test/src/components/DamageForm.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('onSave') || line.includes('projectTitle')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
