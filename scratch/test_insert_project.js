import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aoxduqspiezzyqeqyzzl.supabase.co',
  'sb_publishable_HZzncDQUEtA8XN6HhT0ysA_K-Ho2eEL'
);

async function run() {
  const email = 'test-env-user@qtool.local';
  const password = 'TestEnvPassword123!';
  
  console.log('Logging in...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error('Sign in failed:', signInError.message);
    return;
  }
  console.log('Login successful. Inserting project...');

  const dummyReport = {
    id: 'test-project-123',
    project_title: 'Test Projekt 123',
    client: 'Test Kunde',
    address: 'Test Str. 45, 12345 Berlin',
    status: 'Schadenaufnahme',
    date: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('damage_reports')
    .upsert(dummyReport);

  if (error) {
    console.error('Upsert failed:', error);
  } else {
    console.log('Upsert successful! Row inserted.', data);
  }
}
run();
