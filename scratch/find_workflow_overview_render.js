import fs from 'fs';

const content = fs.readFileSync('c:/QTool_Test/src/components/WorkflowStatusOverview.jsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('export default') || line.includes('function WorkflowStatusOverview')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
