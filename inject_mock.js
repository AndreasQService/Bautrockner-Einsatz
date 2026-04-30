import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function injectMockData() {
  const mockReport = {
    id: uuidv4(),
    projectTitle: 'Wasserschaden Test-Projekt (Measurement)',
    client: 'Test Verwaltung AG',
    address: 'Musterstraße 12, 8000 Zürich',
    status: 'Schadenaufnahme',
    date: new Date().toISOString(),
    assignedTo: 'Techniker 1',
    rooms: [
      {
        id: uuidv4(),
        name: 'Wohnzimmer',
        length: 5.5,
        width: 4.0,
        height: 2.5
      },
      {
        id: uuidv4(),
        name: 'Küche',
        length: 3.0,
        width: 3.0,
        height: 2.5
      }
    ]
  };

  const rowData = {
    id: mockReport.id,
    project_title: mockReport.projectTitle,
    client: mockReport.client,
    address: mockReport.address,
    status: mockReport.status,
    assigned_to: mockReport.assignedTo,
    date: mockReport.date,
    report_data: mockReport,
    updated_at: new Date().toISOString()
  };

  console.log("Inserting mock project...");
  const { data, error } = await supabase.from('damage_reports').upsert(rowData).select();

  if (error) {
    console.error("Error inserting data:", error);
  } else {
    console.log("Success! Mock project inserted:", data[0].project_title);
  }
}

injectMockData();
