const fs = require('fs');
let content = fs.readFileSync('src/components/DamageForm.jsx', 'utf8');

// Replace color back to white for elements that have specific solid backgrounds
// Common backgrounds: '#3B82F6', 'var(--primary)', '#10B981', '#EF4444', '#1E6DB7'

const backgrounds = [
    "'#3B82F6'", 
    "'var(--primary)'", 
    "'#10B981'", 
    "'#EF4444'", 
    "'#1E6DB7'",
    "var\\(--primary\\)"
];

for (let bg of backgrounds) {
    // Regex to match: background(Color)?: bg ... color: '#1E293B'
    // Since properties can be in any order, we do two passes:
    // Pass 1: bg then color
    let regex1 = new RegExp(`(background(?:Color)?\\s*:\\s*${bg}[^}]*color\\s*:\\s*)'#1E293B'`, 'g');
    content = content.replace(regex1, "$1'white'");

    // Pass 2: color then bg
    let regex2 = new RegExp(`(color\\s*:\\s*)'#1E293B'([^}]*background(?:Color)?\\s*:\\s*${bg})`, 'g');
    content = content.replace(regex2, "$1'white'$2");
}

// Fix "Foto hinzufügen" which might be 'var(--primary)'
// It's in the ContactSection or Map section? No, "Foto hinzufügen" is in DamageForm.
// Let's specifically look for 'Foto hinzufügen' and 'Kamera' and 'Raum hinzufügen'
content = content.replace(
    /(<button[^>]*>[\s\S]*?)Foto hinzufügen/g,
    (match, p1) => {
        return match.replace(/color:\s*'#1E293B'/g, "color: 'white'");
    }
);

content = content.replace(
    /(<button[^>]*>[\s\S]*?)Kamera/g,
    (match, p1) => {
        return match.replace(/color:\s*'#1E293B'/g, "color: 'white'");
    }
);

content = content.replace(
    /(<button[^>]*>[\s\S]*?)Raum hinzufügen/g,
    (match, p1) => {
        return match.replace(/color:\s*'#1E293B'/g, "color: 'white'");
    }
);

fs.writeFileSync('src/components/DamageForm.jsx', content);
console.log('Fixed button text colors in DamageForm.jsx');
