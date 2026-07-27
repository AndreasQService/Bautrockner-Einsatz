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
  console.log('Login successful. Checking damage_reports table...');

  const { data: reports, error: reportsError } = await supabase
    .from('damage_reports')
    .select('id, project_title, client, address, status, deleted_at, updated_at');

  if (reportsError) {
    console.error('Failed to query damage_reports:', reportsError.message);
  } else {
    console.log(`Query successful. Found ${reports?.length || 0} rows:`);
    console.log(JSON.stringify(reports, null, 2));
  }
}
run();
