import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://aoxduqspiezzyqeqyzzl.supabase.co',
  'sb_publishable_HZzncDQUEtA8XN6HhT0ysA_K-Ho2eEL'
);

async function run() {
  const email = 'test-env-user@qtool.local';
  const password = 'TestEnvPassword123!';
  
  console.log('1. Attempting sign up...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.warn('Sign up returned/failed:', signUpError.message);
  } else {
    console.log('Sign up successful! User ID:', signUpData.user?.id);
  }

  console.log('2. Attempting sign in...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error('Sign in failed:', signInError.message);
  } else {
    console.log('Sign in successful! Session access token present:', !!signInData.session?.access_token);
  }
}
run();
