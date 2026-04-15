const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://yxdoecdqttgdncgbzyus.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4ZG9lY2RxdHRnZG5jZ2J6eXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MTE3OTIsImV4cCI6MjA4NjA4Nzc5Mn0.Jfl_mC9qzR06IaUL6fcD4sYWMoQP83ugVmKUG7r9VrQ'
);

async function main() {
    const { data, error } = await supabase
        .from('damage_reports')
        .select('id, project_title, address, status, client, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Fehler:', error);
        return;
    }

    console.log(`\nTotal Projekte in Supabase: ${data.length}\n`);
    console.log('--- Alle Projekte ---');
    data.forEach((r, i) => {
        console.log(`${i+1}. [${r.status}] ${r.address || r.project_title || r.id} | ${r.client || ''}`);
    });

    console.log('\n--- Suche Cholplatz ---');
    const cholplatz = data.filter(r => 
        (r.address || '').toLowerCase().includes('cholplatz') ||
        (r.project_title || '').toLowerCase().includes('cholplatz') ||
        (r.id || '').toLowerCase().includes('cholplatz')
    );
    if (cholplatz.length === 0) {
        console.log('NICHT GEFUNDEN in Supabase!');
    } else {
        cholplatz.forEach(r => console.log('GEFUNDEN:', r.id, r.address, r.status));
    }
}

main();
