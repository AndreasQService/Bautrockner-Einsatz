const { createClient } = require('@supabase/supabase-js');

// Init Supabase
const supabaseUrl = 'https://yxdoecdqttgdncgbzyus.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4ZG9lY2RxdHRnZG5jZ2J6eXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MTE3OTIsImV4cCI6MjA4NjA4Nzc5Mn0.Jfl_mC9qzR06IaUL6fcD4sYWMoQP83ugVmKUG7r9VrQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
  console.log("=== SUPABASE DATA INSPECTION ===");

  const { data, error } = await supabase
    .from('damage_reports')
    .select('id, updated_at, created_at, report_data')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error("Fetch Error:", error);
    return;
  }

  console.log(`Fetched ${data.length} records.`);

  // 1. Analyze IDs
  let hasTmpIds = false;
  let allUUIDs = true;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let reportDataIsString = false;
  
  let reportsWithRooms = 0;
  let totalRooms = 0;
  let totalMeasurements = 0;
  let totalHistories = 0;

  for (const row of data) {
    if (typeof row.id !== 'string' || !uuidRegex.test(row.id)) {
      allUUIDs = false;
    }
    if (typeof row.id === 'string' && row.id.startsWith('TMP-')) {
      hasTmpIds = true;
    }

    if (typeof row.report_data === 'string') {
      reportDataIsString = true;
    }

    const reportData = typeof row.report_data === 'string' ? JSON.parse(row.report_data) : row.report_data;
    
    if (reportData && reportData.rooms && Array.isArray(reportData.rooms)) {
      reportsWithRooms++;
      totalRooms += reportData.rooms.length;

      for (const room of reportData.rooms) {
        if (room.measurementData && room.measurementData.measurements) {
          totalMeasurements += room.measurementData.measurements.length;
        }
        if (room.measurementHistory) {
          totalHistories += room.measurementHistory.length;
        }
      }
    }
  }

  console.log("\n--- A/B: ID Types ---");
  console.log("All IDs are UUID format:", allUUIDs);
  console.log("Found TMP- IDs:", hasTmpIds);
  console.log("Sample IDs:", data.slice(0, 5).map(r => r.id).join(", "));

  console.log("\n--- C: report_data Format ---");
  console.log("report_data is returned as STRING (requires JSON.parse):", reportDataIsString);
  console.log("report_data is returned as JSON OBJECT:", !reportDataIsString);

  console.log("\n--- D/E/F/G: Rooms & Measurements ---");
  console.log(`Reports with rooms: ${reportsWithRooms} / ${data.length}`);
  console.log(`Total rooms found: ${totalRooms}`);
  console.log(`Total measurement points found (current): ${totalMeasurements}`);
  console.log(`Total measurement histories found: ${totalHistories}`);

}

analyze();
