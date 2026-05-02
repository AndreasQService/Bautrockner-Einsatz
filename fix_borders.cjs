const fs = require('fs');
let content = fs.readFileSync('src/components/DamageForm.jsx', 'utf8');

// Replace tile borders
content = content.replace(
    /border:\s*'1px solid #E2E8F0',\s*borderLeft:\s*`4px solid \$\{tile\.color\}`/g,
    "border: '2px solid #1E6DB7'"
);
content = content.replace(
    /border:\s*'1px solid #E2E8F0',\s*borderLeft:\s*`4px solid \$\{TECH_TILES\[4\]\.color\}`/g,
    "border: '2px solid #1E6DB7'"
);

// If there are any other left borders
content = content.replace(
    /borderLeft:\s*`4px solid \$\{tile\.color\}`/g,
    "border: '2px solid #1E6DB7'"
);

fs.writeFileSync('src/components/DamageForm.jsx', content);
console.log('Done');
