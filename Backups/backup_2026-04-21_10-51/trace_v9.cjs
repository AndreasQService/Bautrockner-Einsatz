
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
            const op = stack.pop();
            if (lineNum >= 2930 && lineNum <= 2950) {
                console.log(`Line ${lineNum} closes Line ${op.line}: ${op.text}`);
            }
        } else {
            console.log(`EXTRA CLOSE at Line ${lineNum}: ${fullTag}`);
        }
    } else {
        stack.push({ line: lineNum, text: fullTag.substring(0, 80) });
    }
}

console.log('Final Stack Size:', stack.length);
stack.forEach(s => console.log(`Unclosed: Line ${s.line}`));
