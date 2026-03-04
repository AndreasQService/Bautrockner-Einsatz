
const fs = require('fs');
const content = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');
const block = content.split('\n').slice(2380, 2620).join('\n');

const opens = block.match(/<div\b/g).length;
const closers = block.match(/<\/div\b[^>]*>/g).length;
const selfClosers = (block.match(/<div\b[^>]*\/>/g) || []).length;

console.log(`Block 2380-2620: Opens: ${opens}, Closers: ${closers}, Self: ${selfClosers}, Net: ${opens - closers - selfClosers}`);
