import fs from 'fs';

const content = fs.readFileSync('c:/QTool_Test/src/components/WorkflowStatusOverview.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('type="checkbox"') || line.toLowerCase().includes('checkbox')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
