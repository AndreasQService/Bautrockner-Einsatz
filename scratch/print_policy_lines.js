import fs from 'fs';

const content = fs.readFileSync('c:/QTool_Test/supabase/apply_test_schema.sql', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('damage_reports')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
    // Print 5 lines before and after
    for (let i = Math.max(0, idx - 5); i < Math.min(lines.length, idx + 5); i++) {
      console.log(`  [${i + 1}] ${lines[i].trim()}`);
    }
    console.log('-----------------------------------');
  }
});
