
const fs = require('fs');
const code = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');
const lines = code.split('\n');
let stack = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tags = line.match(/<(\/?)div\b/g);
    if (!tags) continue;

    for (const tag of tags) {
        if (tag === '<div') {
            stack.push(i + 1);
        } else {
            if (stack.length > 0) {
                stack.pop();
            } else {
                console.log('Extra </div> at line ' + (i + 1));
            }
        }
    }
}

console.log('Open divs: ' + stack.length);
stack.forEach(line => console.log('  Opened at line ' + line));
