
const fs = require('fs');
const content = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');

const regex = /<(\/?)div\b[\s\S]*?>/g;
const stack = [];
let match;

while ((match = regex.exec(content)) !== null) {
    const fullTag = match[0];
    const isClosing = match[1] === '/';
    const isSelfClosing = fullTag.endsWith('/>');

    if (isSelfClosing) continue;

    const absolutePos = match.index;
    const linesBefore = content.substring(0, absolutePos).split('\n');
    const lineNum = linesBefore.length;

    if (isClosing) {
        if (stack.length > 0) {
            const popped = stack.pop();
            // Optional: log closing
            if (lineNum > 5720) console.log(`Line ${lineNum}: Matched </div > with opening from line ${popped.line}`);
        } else {
            console.log(`EXTRA CLOSING DIV at line ${lineNum}: ${fullTag}`);
        }
    } else {
        stack.push({ line: lineNum, text: fullTag.split('\n')[0] });
    }
}

console.log('Final Stack size:', stack.length);
if (stack.length > 0) {
    stack.forEach(s => console.log(`Unclosed div from line ${s.line}: ${s.text}`));
}
