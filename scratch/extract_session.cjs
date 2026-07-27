const fs = require('fs');
const path = require('path');

const leveldbPath = 'C:\\Users\\Andreas Q-Service\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Local Storage\\leveldb';

if (!fs.existsSync(leveldbPath)) {
  console.error("Path does not exist:", leveldbPath);
  process.exit(1);
}

console.log("Searching LevelDB files for ALL JWT tokens...");

for (const file of fs.readdirSync(leveldbPath)) {
  if (file.endsWith('.log') || file.endsWith('.ldb')) {
    try {
      const filePath = path.join(leveldbPath, file);
      const data = fs.readFileSync(filePath);
      
      const jwtHeader = 'eyJhbGciOi';
      let idx = -1;
      while ((idx = data.indexOf(jwtHeader, idx + 1)) !== -1) {
        let token = '';
        for (let i = idx; i < data.length; i++) {
          const char = String.fromCharCode(data[i]);
          if (/^[a-zA-Z0-9\.\-\_]$/.test(char)) {
            token += char;
          } else {
            break;
          }
        }
        
        const parts = token.split('.');
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            console.log(`Found JWT in ${file}:`);
            console.log("  Email:", payload.email || payload.name || 'N/A');
            console.log("  Issuer:", payload.iss || 'N/A');
            console.log("  Exp:", new Date(payload.exp * 1000).toLocaleString());
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    } catch (e) {
      // Ignore read errors
    }
  }
}
console.log("Search complete.");
