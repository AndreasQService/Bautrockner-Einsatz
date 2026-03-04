
import fs from 'fs';
const content = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');

const lines = content.split('\n');
const stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Better regex to find tags
    const regex = /<(\/?)div\b[^>]*>/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
        const fullTag = match[0];
        const isClosing = match[1] === '/';
        const isSelfClosing = fullTag.endsWith('/>');

        if (isSelfClosing) continue;

        if (isClosing) {
            if (stack.length > 0) {
                stack.pop();
            } else {
                console.log(`EXTRA CLOSING DIV at line ${lineNum}: ${line.trim()}`);
            }
        } else {
            stack.push({ line: lineNum, text: line.trim() });
        }
    }
}

console.log('Final Stack size:', stack.length);
if (stack.length > 0) {
    stack.forEach(s => console.log(`Unclosed div from line ${s.line}: ${s.text}`));
}
