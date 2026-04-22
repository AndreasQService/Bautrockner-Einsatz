const { execSync } = require('child_process');
const fs = require('fs');
const content = execSync('git show 3d67681:src/components/DamageForm.jsx').toString('utf8');
const lines = content.split('\n');
let found = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Centered Schadensbericht')) {
        console.log("Found at line", i);
        for (let j = Math.max(0, i - 10); j < Math.min(lines.length, i + 30); j++) {
            console.log(lines[j]);
        }
        console.log("-------------------");
    }
}
