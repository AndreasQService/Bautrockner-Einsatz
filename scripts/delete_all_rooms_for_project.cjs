const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const projectId = process.argv[2];
  
  if (!projectId) {
    console.error("Please provide a projectId as argument!");
    console.log("Example: node scripts/delete_all_rooms_for_project.js <PROJECT_ID>");
    
    // Auto-fetch last updated project as a helper
    const { data } = await supabase.from('damage_reports').select('id, project_title, updated_at, report_data').order('updated_at', { ascending: false }).limit(3);
    if (data && data.length > 0) {
      console.log("\nRecent projects you might want to wipe:");
      data.forEach(d => {
        const rc = (d.report_data && d.report_data.rooms) ? d.report_data.rooms.length : 0;
        console.log(`- ${d.id} (${d.project_title}) - Rooms: ${rc}`);
      });
    }
    process.exit(1);
  }

  // 1. Fetch Row
  const { data: row, error: fetchError } = await supabase
    .from('damage_reports')
    .select('*')
    .eq('id', projectId)
    .single();

  if (fetchError || !row) {
    console.error("Error fetching row or not found:", fetchError);
    process.exit(1);
  }

  // 2. Backup
  const backupDir = 'C:\\QTool_Savepoints';
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `supabase_before_delete_rooms_${projectId.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.json`);
  
  fs.writeFileSync(backupPath, JSON.stringify(row, null, 2));
  console.log(`[Backup] Row saved to: ${backupPath}`);
  
  const oldRoomsCount = (row.report_data && row.report_data.rooms) ? row.report_data.rooms.length : 0;
  console.log(`[Info] Old rooms count: ${oldRoomsCount}`);

  // 3. Clear rooms
  if (!row.report_data) row.report_data = {};
  row.report_data.rooms = [];
  
  // 4. Update
  const { error: updateError } = await supabase
    .from('damage_reports')
    .update({ report_data: row.report_data, updated_at: new Date().toISOString() })
    .eq('id', projectId);

  if (updateError) {
    console.error("Error updating row:", updateError);
    process.exit(1);
  }

  // 5. Verify
  const { data: verifyRow } = await supabase
    .from('damage_reports')
    .select('report_data')
    .eq('id', projectId)
    .single();
    
  const newRoomsCount = (verifyRow && verifyRow.report_data && verifyRow.report_data.rooms) ? verifyRow.report_data.rooms.length : -1;
  console.log(`[Success] Rooms cleared. New rooms count: ${newRoomsCount}`);
}

run();
