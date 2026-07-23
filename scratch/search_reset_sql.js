import fs from 'fs';

const content = fs.readFileSync('c:/QTool_Test/supabase/apply_qtool_test_reset.sql', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('damage_reports') || line.toLowerCase().includes('policy') || line.toLowerCase().includes('row level security')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
