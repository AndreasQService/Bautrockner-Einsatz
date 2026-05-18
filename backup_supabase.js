import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function backup() {
  const ts = '20260517_0923';
  const projectId = 'P-1778223875749';
  const backupDir = 'C:\\QTool_Savepoints\\qtool_before_pc_restart_' + ts;
  
  const supabaseUrl = 'https://yxdoecdqttgdncgbzyus.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4ZG9lY2RxdHRnZG5jZ2J6eXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MTE3OTIsImV4cCI6MjA4NjA4Nzc5Mn0.Jfl_mC9qzR06IaUL6fcD4sYWMoQP83ugVmKUG7r9VrQ';
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('damage_report_rooms')
    .select('*')
    .eq('report_id', projectId);
    
  if (error) {
    console.error('Error fetching damage_report_rooms from Supabase:', error);
    process.exit(1);
  }
  
  const { data: measurementsData, error: measurementsError } = await supabase
    .from('room_measurements')
    .select('*')
    .eq('report_id', projectId);

  if (measurementsError) {
    console.error('Error fetching room_measurements from Supabase:', measurementsError);
    process.exit(1);
  }

  const { data: protocolsData, error: protocolsError } = await supabase
    .from('measurement_protocols')
    .select('*')
    .eq('report_id', projectId);

  if (protocolsError) {
    console.error('Error fetching measurement_protocols from Supabase:', protocolsError);
    process.exit(1);
  }
  
  const finalData = {
    rooms: data,
    measurements: measurementsData,
    protocols: protocolsData
  };
  
  const fileName = `supabase_before_pc_restart_${projectId}_${ts}.json`;
  const filePath = path.join(backupDir, fileName);
  
  fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
  console.log('Supabase backup saved to:', filePath);
}

backup();
