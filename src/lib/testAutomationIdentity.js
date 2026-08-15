const TEST_SUPABASE_REF = 'aoxduqspiezzyqeqyzzl';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export function assertTestAutomationRuntime(location = globalThis.location) {
  const environment = normalize(import.meta.env.VITE_QTOOL_ENVIRONMENT);
  const expectedRef = normalize(import.meta.env.VITE_EXPECTED_SUPABASE_PROJECT_ID);
  const allowedHost = normalize(import.meta.env.VITE_AUTOMATION_ALLOWED_HOST);
  const actualHost = normalize(location?.hostname);
  const supabaseUrl = normalize(import.meta.env.VITE_SUPABASE_URL);

  if (environment !== 'test') throw new Error('Test automation is disabled');
  if (expectedRef !== TEST_SUPABASE_REF) {
    throw new Error('Test Supabase rejected');
  }
  if (!supabaseUrl.includes(`${TEST_SUPABASE_REF}.supabase.co`)) throw new Error('Test Supabase rejected');
  if (!allowedHost || actualHost !== allowedHost) throw new Error('Automation host rejected');
}

/**
 * Converts only the dedicated, server-authenticated Test Supabase identity to a
 * QTool UI identity. UUID and email are public identifiers, not credentials;
 * authorization still comes exclusively from Supabase's verified user/session.
 */
export async function resolveTestAutomationIdentity(supabase, location = globalThis.location) {
  assertTestAutomationRuntime(location);
  if (!supabase?.auth?.getUser) throw new Error('Supabase auth unavailable');

  const expectedId = normalize(import.meta.env.VITE_AUTOMATION_USER_ID);
  const expectedEmail = normalize(import.meta.env.VITE_AUTOMATION_USER_EMAIL);
  if (!UUID_RE.test(expectedId) || !expectedEmail) throw new Error('Automation identity is not configured');

  // getUser performs an authoritative Auth-server check. Never trust local
  // storage, URL parameters, JWT decoding, or a caller-provided user object.
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user || normalize(user.id) !== expectedId || normalize(user.email) !== expectedEmail) {
    throw new Error('Automation identity rejected');
  }

  return Object.freeze({
    id: user.id,
    authUserId: user.id,
    email: user.email,
    name: 'QTool E2E Operator',
    role: 'user',
    isAutomationOperator: true,
  });
}

function clearAuthUiState(storage) {
  if (!storage) return;
  const removals = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    if (
      key.startsWith('qtool_current_user_') ||
      key.startsWith('qtool_session_token_') ||
      key === 'qservice_selected_report_id' ||
      key === 'qservice_current_view'
    ) removals.push(key);
  }
  removals.forEach((key) => storage.removeItem(key));
}

/**
 * Globally revokes the short-lived operator session and removes only auth/UI
 * state. Durable offline business records are intentionally retained: deleting
 * them during logout would itself create a data-loss path.
 */
export async function revokeTestAutomationIdentity(supabase, storage = globalThis.localStorage) {
  assertTestAutomationRuntime(globalThis.location);
  let signOutError = null;
  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    signOutError = error || null;
  } finally {
    clearAuthUiState(storage);
    if (globalThis.sessionStorage) clearAuthUiState(globalThis.sessionStorage);
  }
  if (signOutError) throw signOutError;
}
