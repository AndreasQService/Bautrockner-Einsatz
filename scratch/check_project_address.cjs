const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://yxdoecdqttgdncgbzyus.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4ZG9lY2RxdHRnZG5jZ2J6eXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MTE3OTIsImV4cCI6MjA4NjA4Nzc5Mn0.Jfl_mC9qzR06IaUL6fcD4sYWMoQP83ugVmKUG7r9VrQ'
);

async function main() {
    console.log('Suche Projekt mit Nummer/ID 20250353...');
    const { data, error } = await supabase
        .from('damage_reports')
        .select('*');

    if (error) {
        console.error('Fehler beim Abrufen:', error);
        return;
    }

    const matches = data.filter(r => 
        String(r.id).includes('20250353') ||
        (r.project_title && String(r.project_title).includes('20250353')) ||
        (r.report_data && String(r.report_data.projectNumber).includes('20250353'))
    );

    if (matches.length === 0) {
        console.log('Kein Projekt für 20250353 in Supabase gefunden.');
        console.log('Liste die letzten 5 Projekte:');
        data.slice(0, 5).forEach(r => {
            console.log(`- ID: ${r.id}, Titel: ${r.project_title}, Adresse: ${r.address}`);
        });
    } else {
        matches.forEach(r => {
            console.log('=== GEFUNDEN ===');
            console.log('ID:', r.id);
            console.log('Project Title in DB column:', r.project_title);
            console.log('Address in DB column:', r.address);
            console.log('Report Data keys:', Object.keys(r.report_data || {}));
            console.log('Report Data street:', r.report_data?.street);
            console.log('Report Data locationDetails:', r.report_data?.locationDetails);
            console.log('Report Data zip:', r.report_data?.zip);
            console.log('Report Data city:', r.report_data?.city);
            console.log('Report Data projectNumber:', r.report_data?.projectNumber);
            console.log('Full report_data JSON:', JSON.stringify(r.report_data, null, 2).slice(0, 1000));
        });
    }
}

main();
