
const fs = require('fs');
const content = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');

function checkBalance(open, close, label) {
    let count = 0;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const char of line) {
            if (char === open) count++;
            if (char === close) count--;
            if (count < 0) {
                console.log(`EXTRA ${close} at L${i + 1}`);
                count = 0;
            }
        }
    }
    console.log(`${label} Final Count: ${count}`);
}

checkBalance('{', '}', 'Braces');
checkBalance('(', ')', 'Parens');
checkBalance('[', ']', 'Brackets');
