import fs from 'fs';
import path from 'path';

const searchDir = 'c:/QTool_Test';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (file === 'node_modules' || file === '.git' || file === '.gemini') return;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else {
      if (file.endsWith('.sql')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.toLowerCase().includes('damage_reports')) {
          results.push(fullPath);
        }
      }
    }
  });
  return results;
}

console.log('Searching for damage_reports in sql files...');
const found = walk(searchDir);
found.forEach(f => {
  console.log('--- FILE:', f);
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('policy') || line.toLowerCase().includes('security') || line.toLowerCase().includes('damage_reports')) {
      console.log(`${idx + 1}: ${line.trim()}`);
    }
  });
});
