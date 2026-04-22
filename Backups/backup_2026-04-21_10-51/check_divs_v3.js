
import fs from 'fs';
const content = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');

const lines = content.split('\n');
const stack = [];

lines.forEach((line, i) => {
    const lineNum = i + 1;
    let pos = 0;

    // Find ALL matches of <div or </div
    // We'll use a regex to find them properly
    const regex = /<\/?div[ >]/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
        const tag = match[0];
        if (tag.startsWith('</')) {
            // Closing tag
            if (stack.length > 0) {
                stack.pop();
            } else {
                console.log(`Extra closing div at line ${lineNum}: ${line.trim()}`);
            }
        } else {
            // Opening tag. Check if it's self-closing <div ... />
            // Find the nearest closing > after this match
            const restOfLine = line.substring(match.index);
            const closeTagIdx = restOfLine.indexOf('>');
            if (closeTagIdx !== -1) {
                if (restOfLine[closeTagIdx - 1] === '/') {
                    // Self-closing, ignore
                } else {
                    stack.push({ line: lineNum, content: line.trim() });
                }
            } else {
                // Multiline tag, assume it's opening
                stack.push({ line: lineNum, content: line.trim() });
            }
        }
    }
});

if (stack.length > 0) {
    console.log(`!!! Found ${stack.length} unclosed div tags !!!`);
    console.log('Last 5 unclosed:');
    stack.slice(-5).reverse().forEach(s => console.log(`Line ${s.line}: ${s.content}`));
} else {
    console.log('All div tags balanced!');
}
