
const fs = require('fs');
const code = fs.readFileSync('c:/QTool/src/components/DamageForm.jsx', 'utf8');
const open = (code.match(/<div\b/g) || []).length;
const close = (code.match(/<\/div>/g) || []).length;
const selfClose = (code.match(/<div[^>]*\/>/g) || []).length;
const netOpen = open - selfClose;
console.log('Open:', open, 'Close:', close, 'SelfClose:', selfClose, 'NetOpen:', netOpen);
if (netOpen !== close) {
    console.log('DIFF:', netOpen - close);
} else {
    console.log('BALANCED');
}
