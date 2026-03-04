
const fs = require('fs');
const content = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');
const lines = content.split('\n');
let stackCount = 0;
const regex = /<(\/?)div\b[^>]*>/g;

for (let i = 0; i < 1924; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    let match;
    while ((match = regex.exec(line)) !== null) {
        const fullTag = match[0];
        const isClosing = match[1] === '/';
        const isSelfClosing = fullTag.endsWith('/>');

        if (isSelfClosing) continue;

        if (isClosing) {
            stackCount--;
            if (stackCount < 0) {
                console.log(`Stack went negative at line ${lineNum}: ${line.trim()}`);
            }
        } else {
            stackCount++;
        }
    }
}
console.log('Final stack count at line 1924:', stackCount);
