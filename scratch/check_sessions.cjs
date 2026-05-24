const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://yxdoecdqttgdncgbzyus.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4ZG9lY2RxdHRnZG5jZ2J6eXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MTE3OTIsImV4cCI6MjA4NjA4Nzc5Mn0.Jfl_mC9qzR06IaUL6fcD4sYWMoQP83ugVmKUG7r9VrQ'
);

async function main() {
    console.log('Fetching active sessions from project_sessions...');
    const { data, error } = await supabase
        .from('project_sessions')
        .select('*');

    if (error) {
        console.error('Error fetching sessions:', error);
        return;
    }

    console.log('=== ACTIVE SESSIONS ===');
    console.log(JSON.stringify(data, null, 2));
}

main();
