
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
                // console.log(`  Match: Line ${opener.line} with Line ${lineNum}`);
            } else {
                console.log(`!!! UNMATCHED CLOSING DIV AT LINE ${lineNum}: ${line.trim()}`);
            }
        } else {
            // Check if self-closing on this line
            const restOfLine = line.substring(match.index);
            const closeTagIdx = restOfLine.indexOf('>');
            let selfClosing = false;
            if (closeTagIdx !== -1) {
                if (restOfLine[closeTagIdx - 1] === '/') {
                    selfClosing = true;
                }
            } else {
                // Peek next lines for self-closing? 
                // Or just assume it's opening if we don't see /> on same line
                // In JSX it's very rare to have <div \n />
            }

            if (!selfClosing) {
                stack.push({ line: lineNum, content: line.trim() });
            }
        }
    }
});

if (stack.length > 0) {
    console.log(`!!! UNCLOSED !!! (Total: ${stack.length})`);
    stack.forEach(s => console.log(`  Line ${s.line}: ${s.content}`));
} else {
    console.log('Final Stack is empty.');
}
