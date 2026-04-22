
const fs = require('fs');
const content = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');

let stack = [];
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let j = 0; j < line.length; j++) {
        let char = line[j];
        if (char === '{' || char === '(' || char === '[') {
            stack.push({ char, line: i + 1, col: j + 1 });
        } else if (char === '}' || char === ')' || char === ']') {
            if (stack.length === 0) {
                console.log(`EXTRA CLOSE: ${char} at L${i + 1}, C${j + 1}`);
                continue;
            }
            let last = stack.pop();
            if ((char === '}' && last.char !== '{') ||
                (char === ')' && last.char !== '(') ||
                (char === ']' && last.char !== '[')) {
                console.log(`MISMATCH: ${last.char} opened at L${last.line}, C${last.col} closed by ${char} at L${i + 1}, C${j + 1}`);
            }
        }
    }
}

if (stack.length > 0) {
    console.log(`STILL OPEN: ${stack.length}`);
    stack.forEach(s => console.log(`  ${s.char} opened at L${s.line}, C${s.col}`));
} else {
    console.log('BALANCED BRACKETS');
}
