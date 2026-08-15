let explicitFinalSync = null;

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TECHNICAL_LOCK_RPCS = new Set([
  'acquire_project_lock', 'release_project_lock', 'renew_project_lock',
  'create_project_and_acquire_lock',
]);

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input?.url || '';
}

function requestMethod(input, init) {
  return String(init?.method || input?.method || 'GET').toUpperCase();
}

function rpcName(url) {
  const match = String(url).match(/\/rest\/v1\/rpc\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function isSupabaseBusinessMutation(input, init) {
  const method = requestMethod(input, init);
  const url = requestUrl(input);
  return MUTATING_METHODS.has(method) && (
    /\/rest\/v1\//i.test(url) || /\/storage\/v1\/object(?:\/|$)/i.test(url) ||
    /\/functions\/v1\//i.test(url)
  );
}

export function beginExplicitProjectFinalSync({ projectId, ownerSessionToken }) {
  if (!projectId) throw new Error('Projekt-ID für Abschluss-Synchronisierung fehlt');
  if (!ownerSessionToken) throw new Error('Besitzer-Session-Token für Abschluss-Synchronisierung fehlt');
  if (explicitFinalSync) throw new Error('Eine Abschluss-Synchronisierung läuft bereits');
  const context = {
    projectId: String(projectId),
    ownerSessionToken: String(ownerSessionToken),
    nonce: crypto.randomUUID(),
  };
  explicitFinalSync = context;
  return context;
}

export function endExplicitProjectFinalSync(context) {
  if (explicitFinalSync?.nonce === context?.nonce) explicitFinalSync = null;
}

export function getExplicitProjectFinalSync() {
  return explicitFinalSync ? { ...explicitFinalSync } : null;
}

export async function assertOneDriveWriteAllowed(method = 'GET', { hasActiveSession = null } = {}) {
  if (!MUTATING_METHODS.has(String(method).toUpperCase())) return;
  let activeSessionCheck = hasActiveSession;
  if (!activeSessionCheck) {
    ({ hasActiveProjectSession: activeSessionCheck } = await import('./projectSessionStore.js'));
  }
  if (!await activeSessionCheck()) return;
  if (explicitFinalSync?.projectId && explicitFinalSync?.ownerSessionToken) return;
  const error = new Error('OneDrive-Schreibzugriff während aktiver Offline-Projektsitzung blockiert');
  error.code = 'ACTIVE_PROJECT_SESSION_ONEDRIVE_WRITE_BLOCKED';
  error.retryable = false;
  throw error;
}

/**
 * Zentrale Fail-closed-Barriere für sämtliche Supabase-Businesswrites.
 * Reads, Auth und die technischen Lock-RPCs bleiben verfügbar. Sobald eine
 * lokale Projektsitzung existiert, dürfen REST-/Storage-Mutationen nur im
 * expliziten Abschlussorchestrator mit Besitzer-Token passieren.
 */
export async function assertSupabaseRequestAllowed(input, init, { hasActiveSession = null } = {}) {
  const method = requestMethod(input, init);
  if (!MUTATING_METHODS.has(method)) return;

  const url = requestUrl(input);
  const isRestMutation = /\/rest\/v1\//i.test(url);
  const isStorageMutation = /\/storage\/v1\/object(?:\/|$)/i.test(url);
  const isEdgeFunctionMutation = /\/functions\/v1\//i.test(url);
  if (!isRestMutation && !isStorageMutation && !isEdgeFunctionMutation) return;

  const rpc = rpcName(url);
  if (rpc && TECHNICAL_LOCK_RPCS.has(rpc)) return;

  let activeSessionCheck = hasActiveSession;
  if (!activeSessionCheck) {
    ({ hasActiveProjectSession: activeSessionCheck } = await import('./projectSessionStore.js'));
  }
  if (!await activeSessionCheck()) return;
  if (explicitFinalSync?.projectId && explicitFinalSync?.ownerSessionToken) return;

  const error = new Error('Business-Cloudwrite während aktiver Offline-Projektsitzung blockiert');
  error.code = 'ACTIVE_PROJECT_SESSION_CLOUD_WRITE_BLOCKED';
  error.retryable = false;
  throw error;
}

export function createSessionGuardedFetch(fetchImpl = globalThis.fetch, { hasActiveSession = null } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl fehlt');
  return async (input, init) => {
    await assertSupabaseRequestAllowed(input, init, { hasActiveSession });
    const context = explicitFinalSync;
    if (!context || !isSupabaseBusinessMutation(input, init)) return fetchImpl(input, init);

    // Never mutate a caller-owned Request/Headers object. Supabase/RLS receives
    // both values and binds the write to the active owner/project server-side.
    const headers = new Headers(init?.headers || input?.headers || undefined);
    headers.set('x-qtool-session-token', context.ownerSessionToken);
    headers.set('x-qtool-project-id', context.projectId);
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return fetchImpl(new Request(input, { ...(init || {}), headers }));
    }
    return fetchImpl(input, { ...(init || {}), headers });
  };
}
