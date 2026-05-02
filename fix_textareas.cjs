const fs = require('fs');

let content = fs.readFileSync('src/components/DamageForm.jsx', 'utf8');

// Replace borders on textareas and inputs that have border: '1px solid #E2E8F0' or similar
content = content.replace(
    /border:\s*'1px solid rgba\(16,\s*185,\s*129,\s*0\.2\)'/g,
    "border: '2px solid #1E6DB7'"
);
// We need to be careful not to replace borders of buttons or cards. 
// A safer way is to specifically target <textarea and <input styling.
// Since it's hard to parse JSX with regex safely for all cases, we'll do targeted replaces.

const regexesToReplace = [
    /(\<textarea[^>]*style=\{\{[^\}]*border:\s*)'1px solid rgba\(16, 185, 129, 0\.2\)'/g,
    /(\<textarea[^>]*style=\{\{[^\}]*border:\s*)'1px solid #E2E8F0'/g,
    /(\<textarea[^>]*style=\{\{[^\}]*border:\s*)'1px solid var\(--border\)'/g,
    /(\<input[^>]*style=\{\{[^\}]*border:\s*)'1px solid #E2E8F0'/g,
    /(\<input[^>]*style=\{\{[^\}]*border:\s*)'1px solid var\(--border\)'/g,
];

for (let r of regexesToReplace) {
    content = content.replace(r, "$1'2px solid #1E6DB7'");
}

// And specifically lines 3688 (Bemerkungen), 6071 (Notiz-Textarea), etc.
// Just doing a broad replace for common textarea border definitions:
content = content.replace(/border:\s*'1px solid rgba\(16,\s*185,\s*129,\s*0\.2\)'/g, "border: '2px solid #1E6DB7'");
content = content.replace(/border:\s*`1px solid \$\{listeningField === 'measures' \? '#EF4444' : '#CBD5E1'\}`/g, "border: `2px solid ${listeningField === 'measures' ? '#EF4444' : '#1E6DB7'}`");

fs.writeFileSync('src/components/DamageForm.jsx', content);
console.log('Textareas updated');
