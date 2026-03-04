const { execSync } = require('child_process');
const fs = require('fs');
const content = execSync('git show 3d67681:src/components/DamageForm.jsx').toString('utf8');
const lines = content.split('\n');
let out = '';
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Centered Schadensbericht')) {
        out += "Found at line " + i + "\n";
        for (let j = Math.max(0, i - 20); j < Math.min(lines.length, i + 30); j++) {
            out += lines[j] + "\n";
        }
        out += "-------------------\n";
    }
}
fs.writeFileSync('output_btn_clean.txt', out, 'utf8');
