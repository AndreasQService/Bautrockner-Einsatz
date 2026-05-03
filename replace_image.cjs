const fs = require('fs');
let c = fs.readFileSync('src/components/ImageEditor.jsx', 'utf8');

c = c.replace(/backgroundColor:\s*'#FFFFFF'/g, "backgroundColor: 'var(--surface)'");
c = c.replace(/background:\s*'#FFFFFF'/g, "background: 'var(--surface)'");
c = c.replace(/backgroundColor:\s*'#F8FAFC'/g, "backgroundColor: 'var(--background)'");
c = c.replace(/background:\s*'#F8FAFC'/g, "background: 'var(--background)'");
c = c.replace(/'#F8FAFC'/g, "'var(--background)'");

c = c.replace(/color:\s*'#1E293B'/g, "color: 'var(--text-main)'");
c = c.replace(/'#1E293B'/g, "'var(--text-main)'");
c = c.replace(/'#64748B'/g, "'var(--text-muted)'");

c = c.replace(/'#E2E8F0'/g, "'var(--border)'");
c = c.replace(/'#CBD5E1'/g, "'var(--border)'");

fs.writeFileSync('src/components/ImageEditor.jsx', c);
