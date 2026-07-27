import fs from 'fs';

const content = fs.readFileSync('c:/QTool_Test/supabase/apply_test_schema.sql', 'utf8');
const lines = content.split('\n');
let start = -1;
let end = -1;

lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('create table public.damage_reports ') || line.toLowerCase().includes('create table damage_reports ')) {
    start = idx;
  }
  if (start !== -1 && end === -1 && line.trim() === ');') {
    end = idx;
  }
});

if (start !== -1 && end !== -1) {
  console.log(`Table definition lines ${start + 1} to ${end + 1}:`);
  for (let i = start; i <= end; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} else {
  console.log('CREATE TABLE damage_reports not found.');
}
