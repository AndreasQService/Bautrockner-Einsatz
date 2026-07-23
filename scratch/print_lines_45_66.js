import fs from 'fs';

const content = fs.readFileSync('c:/QTool_Test/supabase/apply_test_schema.sql', 'utf8');
const lines = content.split('\n');
for (let i = 45; i < 66; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
