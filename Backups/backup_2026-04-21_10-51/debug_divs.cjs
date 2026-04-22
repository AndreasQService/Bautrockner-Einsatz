
const fs = require('fs');
const content = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');

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
            console.log(`EXTRA CLOSE at L${lineNum}`);
        }
    } else {
        stack.push({ line: lineNum });
    }
}

if (stack.length > 0) {
    console.log(`STILL OPEN: ${stack.length}`);
    stack.forEach(s => console.log(`Open from L${s.line}`));
} else {
    console.log('BALANCED');
}
