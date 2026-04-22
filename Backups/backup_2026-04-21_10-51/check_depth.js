
import fs from 'fs';
const content = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');

const lines = content.split('\n');
const stack = [];

lines.forEach((line, i) => {
    const lineNum = i + 1;
    const regex = /<\/?div[ >]/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
        const tag = match[0];
        if (tag.startsWith('</')) {
            if (stack.length > 0) {
                const opener = stack.pop();
                if (stack.length === 0) {
                    console.log(`REACHED DEPTH 0 at line ${lineNum}: closes ${opener.line}`);
                }
            } else {
                console.log(`!!! UNMATCHED CLOSING DIV AT LINE ${lineNum}: ${line.trim()}`);
            }
        } else {
            const restOfLine = line.substring(match.index);
            const closeTagIdx = restOfLine.indexOf('>');
            let selfClosing = false;
            if (closeTagIdx !== -1) {
                if (restOfLine[closeTagIdx - 1] === '/') {
                    selfClosing = true;
                }
            }

            if (!selfClosing) {
                if (stack.length === 0) {
                    console.log(`MOVED TO DEPTH 1 at line ${lineNum}`);
                }
                stack.push({ line: lineNum, content: line.trim() });
            }
        }
    }
});
