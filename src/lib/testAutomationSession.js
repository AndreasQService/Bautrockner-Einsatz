import { supabase } from '../supabaseClient.js';
import { resolveTestAutomationIdentity, revokeTestAutomationIdentity } from './testAutomationIdentity.js';

/**
 * Installs a server-issued Supabase session in an automation-controlled browser.
 * Proof material is accepted only in the POST body/header, never in a URL.
 */
export async function installTestAutomationSession({ keyId = 'primary', nonce, issuedAt, signature }) {
  if (import.meta.env.VITE_QTOOL_ENVIRONMENT !== 'test') throw new Error('Test automation is disabled');
  if (window.location.hostname !== import.meta.env.VITE_AUTOMATION_ALLOWED_HOST) throw new Error('Host rejected');

  const response = await fetch('/api/test-automation-session', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      'x-qtool-automation-signature': signature
    },
    body: JSON.stringify({ keyId, nonce, issuedAt })
  });
  const result = await response.json();
  if (!response.ok || !result?.session?.access_token || !result?.session?.refresh_token) {
    throw new Error(result?.error || 'Automation session exchange failed');
  }
  const { data, error } = await supabase.auth.setSession(result.session);
  if (error || !data?.session?.user || data.session.user.id !== result.user.id) {
    await supabase.auth.signOut().catch(() => undefined);
    throw new Error('Automation session verification failed');
  }
  try {
    const qtoolUser = await resolveTestAutomationIdentity(supabase);
    return { requestId: result.requestId, user: result.user, qtoolUser, expiresAt: result.session.expires_at };
  } catch (identityError) {
    await revokeTestAutomationIdentity(supabase).catch(() => undefined);
    throw identityError;
  }
}

export async function revokeTestAutomationSession() {
  return revokeTestAutomationIdentity(supabase);
}
