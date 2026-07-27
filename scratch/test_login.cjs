const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'C:\\QTool_Test\\.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const passwords = [
  'QTool2026!',
  'QTool2026',
  'QTool_Test!',
  'QToolTest!',
  'aoxduqspiezzyqeqyzzl',
  'QService!',
  'Q-Service',
  'Q-Service!',
  'QService2026!',
  'QService',
  'qservice',
  'QService2026',
  'qtool.test.admin',
  'qtool.test.admin@q-service.ch',
  'AndreasQService',
  'Andreas',
  'Andreas!',
  'Andreas123',
  'Andreas123!',
  'Bautrockner',
  'Bautrockner!',
  'Bautrockner123',
  'Bautrockner2026',
  'Bautrockner2026!'
];

async function testPasswords() {
  for (const pwd of passwords) {
    console.log(`Testing password: ${pwd}`);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'qtool.test.admin@q-service.ch',
        password: pwd
      });
      if (!error && data.user) {
        console.log(`\n🎉 SUCCESS! Password is: ${pwd}`);
        console.log("User details:", data.user.id, data.user.email);
        return;
      } else {
        console.log(`Failed: ${error.message}`);
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
  console.log("\n❌ No passwords matched.");
}

testPasswords();
