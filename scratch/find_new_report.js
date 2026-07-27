import fs from 'fs';

const content = fs.readFileSync('c:/QTool_Test/src/App.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('newreport') || line.toLowerCase().includes('createreport')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
