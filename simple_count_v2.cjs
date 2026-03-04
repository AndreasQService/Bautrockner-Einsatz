
const fs = require('fs');
const content = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');

const opens = content.match(/<div\b/g).length;
const closers = content.match(/<\/div\b[^>]*>/g).length;
const selfClosers = (content.match(/<div\b[^>]*\/>/g) || []).length;

console.log(`Opens: ${opens}`);
console.log(`Closers: ${closers}`);
console.log(`Self-closers: ${selfClosers}`);
console.log(`Net: ${opens - closers - selfClosers}`);
