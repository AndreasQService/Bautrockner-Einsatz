
const fs = require('fs');
const content = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');

const regex = /<(\/?)div\b[\s\S]*?>/g;
const stack = [];
let match;

while ((match = regex.exec(content)) !== null) {
    const isClosing = match[1] === '/';
    const isSelfClosing = match[0].endsWith('/>');
    if (isSelfClosing) continue;

    const line = content.substring(0, match.index).split('\n').length;
    if (isClosing) {
        if (stack.length > 0) {
            const op = stack.pop();
            if (line > 1950 || op.line === 868 || op.line === 528) {
                console.log(`L${line} closes L${op.line}`);
            }
        } else {
            console.log(`EXTRA CLOSE at L${line}`);
        }
    } else {
        stack.push({ line, tag: match[0].substring(0, 50) });
    }
}
console.log('REMAINING STACK:', stack.map(s => s.line).join(', '));
