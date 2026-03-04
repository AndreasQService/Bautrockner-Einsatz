
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

    const line = content.substring(0, match.index).split('\n').length;

    if (isClosing) {
        if (stack.length > 0) stack.pop();
        else console.log(`EXTRA CLOSE at L${line}: ${fullTag}`);
    } else {
        stack.push({ line, tag: fullTag.substring(0, 100) });
    }
}

if (stack.length > 0) {
    console.log(`STILL OPEN: ${stack.length}`);
    stack.forEach(s => console.log(`  L${s.line}: ${s.tag}`));
} else {
    console.log('PERFECTLY BALANCED');
}
