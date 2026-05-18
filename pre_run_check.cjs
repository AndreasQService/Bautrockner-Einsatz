const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yxdoecdqttgdncgbzyus.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4ZG9lY2RxdHRnZG5jZ2J6eXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MTE3OTIsImV4cCI6MjA4NjA4Nzc5Mn0.Jfl_mC9qzR06IaUL6fcD4sYWMoQP83ugVmKUG7r9VrQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("=== PRE-RUN CHECKS ===");

  // 1. Table Existence Check
  const tablesToCheck = ['damage_report_rooms', 'room_measurements', 'measurement_protocols', 'audit_log', 'qtool_operations'];
  let anyTableExists = false;

  console.log("\n--- C1. Table Existence ---");
  for (const table of tablesToCheck) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error && error.code === '42P01') {
      console.log(`Table ${table}: Does NOT exist (Safe)`);
    } else if (!error) {
      console.log(`Table ${table}: EXISTS!`);
      anyTableExists = true;
    } else {
      console.log(`Table ${table}: Error checking - ${error.message}`);
    }
  }

  // 2. Legacy Counts Check
  console.log("\n--- D. Legacy Counts VOR Migration ---");
  const { data: reports, error: reportsError } = await supabase
    .from('damage_reports')
    .select('id, report_data');

  if (reportsError) {
    console.error("Error fetching reports:", reportsError);
    return;
  }

  let totalReports = reports.length;
  let legacyRooms = 0;
  let legacyMeasDataCount = 0;
  let legacyMeasHistCount = 0;

  for (const row of reports) {
    const data = typeof row.report_data === 'string' ? JSON.parse(row.report_data) : row.report_data;
    if (data && data.rooms && Array.isArray(data.rooms)) {
      legacyRooms += data.rooms.length;
      for (const room of data.rooms) {
        if (room.measurementData && room.measurementData.measurements) {
          legacyMeasDataCount += room.measurementData.measurements.length;
        }
        if (room.measurementHistory) {
          for (const hist of room.measurementHistory) {
             if (hist.measurements) {
                 legacyMeasHistCount += hist.measurements.length;
             }
          }
        }
      }
    }
  }

  console.log(`total_reports: ${totalReports}`);
  console.log(`legacy_total_rooms: ${legacyRooms}`);
  console.log(`legacy_measurement_data_count: ${legacyMeasDataCount}`);
  console.log(`legacy_measurement_history_count: ${legacyMeasHistCount}`);
}

check();
