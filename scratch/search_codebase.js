import fs from 'fs';
import path from 'path';

const searchDir = 'c:/QTool_Test';
const term = 'TEST_ISOLATION_001';

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
      if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.sql') || file.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(term)) {
          results.push(fullPath);
        }
      }
    }
  });
  return results;
}

console.log(`Searching for "${term}"...`);
const found = walk(searchDir);
console.log('Found in files:', found);
