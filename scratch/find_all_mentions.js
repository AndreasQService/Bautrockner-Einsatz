import fs from 'fs';

const content = fs.readFileSync('c:/QTool_Test/supabase/apply_test_schema.sql', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('damage_reports')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
