
const fs = require('fs');
const file = process.argv[2] || 'c:/QTool/src/components/DamageForm.jsx';
const content = fs.readFileSync(file, 'utf8');

const regex = /<(\/?)div\b[\s\S]*?>/g;
const stack = [];
let match;

while ((match = regex.exec(content)) !== null) {
    const fullTag = match[0].replace(/\n/g, ' ');
    const isClosing = match[1] === '/';
    const isSelfClosing = fullTag.endsWith('/>');

    if (isSelfClosing) continue;

    const absolutePos = match.index;
    const linesBefore = content.substring(0, absolutePos).split('\n');
    const lineNum = linesBefore.length;

    if (isClosing) {
        if (stack.length > 0) {
            stack.pop();
        } else {
            console.log(`EXTRA CLOSE at L${lineNum}: ${fullTag}`);
        }
    } else {
        stack.push({ line: lineNum, text: fullTag.substring(0, 50) });
    }
}

console.log('File:', file);
console.log('Final Stack Size:', stack.length);
stack.forEach(s => console.log(`Unclosed: L${s.line}: ${s.text}`));
