import fs from 'fs';

const content = fs.readFileSync('c:/QTool_Test/src/App.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('projectTitle:') && (line.includes('id') || line.includes('report') || line.includes('new') || line.includes('uuid'))) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
