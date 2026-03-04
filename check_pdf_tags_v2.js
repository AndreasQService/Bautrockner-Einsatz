
import fs from 'fs';
const content = fs.readFileSync('c:/QTool/src/components/pdf/DamageReportDocument.jsx', 'utf8');

const tags = ['Document', 'Page', 'Text', 'View', 'Image'];
const stack = [];

// Split by lines to track line numbers
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const regex = /<(\/?)(\w+)\b[^>]*>/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
        const isClosing = match[1] === '/';
        const tagName = match[2];

        if (!tags.includes(tagName)) continue;

        const fullTag = match[0];
        // Check if self-closing on this line
        const isSelfClosing = fullTag.endsWith('/>');

        if (isSelfClosing) continue;

        if (isClosing) {
            if (stack.length === 0) {
                console.log(`!!! EXTRA CLOSING TAG: </${tagName}> at line ${lineNum}`);
            } else {
                const last = stack.pop();
                if (last.tagName !== tagName) {
                    console.log(`!!! MISMATCH: Opening <${last.tagName}> (line ${last.lineNum}) vs Closing </${tagName}> (line ${lineNum})`);
                }
            }
        } else {
            stack.push({ tagName, lineNum, content: line.trim() });
        }
    }
}

console.log('Final Stack size:', stack.length);
if (stack.length > 0) {
    stack.forEach(s => console.log(`UNCLOSED: <${s.tagName}> from line ${s.lineNum}: ${s.content}`));
}
