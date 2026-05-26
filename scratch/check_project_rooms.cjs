const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://yxdoecdqttgdncgbzyus.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4ZG9lY2RxdHRnZG5jZ2J6eXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MTE3OTIsImV4cCI6MjA4NjA4Nzc5Mn0.Jfl_mC9qzR06IaUL6fcD4sYWMoQP83ugVmKUG7r9VrQ'
);

async function main() {
    console.log('Retrieving rooms and measurementRooms for project 20250353...');
    const { data, error } = await supabase
        .from('damage_reports')
        .select('*');

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    const matches = data.filter(r => 
        String(r.id).includes('20250353') ||
        (r.project_title && String(r.project_title).includes('20250353')) ||
        (r.report_data && String(r.report_data.projectNumber).includes('20250353'))
    );

    matches.forEach(r => {
        console.log('=== PROJECT FOUND ===');
        console.log('ID:', r.id);
        console.log('--- ROOMS IN DB ---');
        console.log(JSON.stringify(r.report_data?.rooms, null, 2));
        console.log('--- MEASUREMENT ROOMS IN DB ---');
        console.log(JSON.stringify(r.report_data?.measurementRooms, null, 2));
    });
}

main();
