
import fs from 'fs';
const content = fs.readFileSync('c:/QTool/src/components/pdf/DamageReportDocument.jsx', 'utf8');

const tags = ['Document', 'Page', 'Text', 'View', 'Image'];
const stack = [];

// Remove comments to avoid false positives
const cleanContent = content.replace(/{\/\*[\s\S]*?\*\/}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const regex = /<(\/?)(\w+)\b[^>]*>/g;
let match;
while ((match = regex.exec(cleanContent)) !== null) {
    const isClosing = match[1] === '/';
    const tagName = match[2];

    if (!tags.includes(tagName)) continue;

    const fullTag = match[0];
    const isSelfClosing = fullTag.endsWith('/>');

    if (isSelfClosing) continue;

    if (isClosing) {
        if (stack.length === 0) {
            console.log(`EXTRA CLOSING TAG: </${tagName}> at index ${match.index}`);
        } else {
            const last = stack.pop();
            if (last.tagName !== tagName) {
                console.log(`MISMATCH: Opening <${last.tagName}> vs Closing </${tagName}> at index ${match.index}`);
            }
        }
    } else {
        stack.push({ tagName, index: match.index });
    }
}

console.log('Final Stack size:', stack.length);
stack.forEach(s => console.log(`Unclosed tag: <${s.tagName}>`));
