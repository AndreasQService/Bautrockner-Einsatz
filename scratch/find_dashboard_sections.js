import fs from 'fs';

const content = fs.readFileSync('c:/QTool_Test/src/components/Dashboard.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('TodoMonitor') || line.includes('WorkflowOverview') || line.includes('Workflow-Übersicht')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
