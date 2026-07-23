const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'C:\\QTool_Test\\.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function dump() {
  const { data, error } = await supabase
    .from('damage_reports')
    .select('*')
    .eq('project_title', 'TEST__ISOLATION_001');

  if (error || data.length === 0) {
    console.error("Error or no project found:", error);
    return;
  }

  const project = data[0];
  console.log("Entire project.report_data keys:", Object.keys(project.report_data || {}));
  console.log("Rooms length in DB:", project.report_data?.rooms?.length);
  console.log("MeasurementRooms length in DB:", project.report_data?.measurementRooms?.length);
  console.log("Description in DB:", project.report_data?.description);
  console.log("Report details:", {
    id: project.id,
    project_title: project.project_title,
    updated_at: project.updated_at
  });
}

dump();
