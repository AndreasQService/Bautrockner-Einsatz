
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
                stack.pop();
            } else {
                console.log(`!!! UNMATCHED CLOSING DIV AT LINE ${lineNum}: ${line.trim()}`);
            }
        } else {
            const restOfLine = line.substring(match.index);
            const closeTagIdx = restOfLine.indexOf('>');
            if (closeTagIdx !== -1) {
                if (restOfLine[closeTagIdx - 1] === '/') {
                    // Ignore self-closing
                } else {
                    stack.push({ line: lineNum, content: line.trim() });
                }
            } else {
                stack.push({ line: lineNum, content: line.trim() });
            }
        }
    }
});

if (stack.length > 0) {
    console.log(`!!! Found ${stack.length} UNCLOSED div tags !!!`);
    stack.forEach(s => console.log(`  Line ${s.line}: ${s.content}`));
} else {
    console.log('All div tags balanced!');
}
