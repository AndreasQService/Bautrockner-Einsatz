import fs from 'fs';

const content = fs.readFileSync('c:/QTool_Test/src/components/TodoMonitor.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('history') || line.toLowerCase().includes('erledigt') || line.toLowerCase().includes('abgeschlossen')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
