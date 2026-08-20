const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const BUILTIN_IDENTITIES = Object.freeze({
  'andreas.strehler@bluewin.ch': { id: 4, name: 'Andreas Strehler', role: 'admin' },
  'a.strehler@q-service.ch': { id: 4, name: 'Andreas Strehler', role: 'admin' },
});

export function resolveAuthorizedUser(authUser, users = []) {
  const authId = String(authUser?.id || '');
  const email = normalizeEmail(authUser?.email);
  if (!authId || !email || authUser?.email_confirmed_at == null) return null;

  const metadataUserId = String(authUser?.app_metadata?.qtool_user_id || '');
  const local = users.find((candidate) => {
    const candidateAuthId = String(candidate?.supabaseUserId || candidate?.auth_user_id || '');
    const candidateEmail = normalizeEmail(candidate?.email || candidate?.authEmail);
    const candidateId = String(candidate?.id || '');
    return (candidateAuthId && candidateAuthId === authId)
      || (candidateEmail && candidateEmail === email)
      || (metadataUserId && candidateId && metadataUserId === candidateId);
  });

  const metadataRole = String(authUser?.app_metadata?.qtool_role || '').toLowerCase();
  const metadataName = String(authUser?.app_metadata?.qtool_display_name || '').trim();
  const metadataIdentity = ['admin', 'technician', 'handwerker', 'user'].includes(metadataRole) && metadataName
    ? { id: authId, name: metadataName, displayName: metadataName, role: metadataRole }
    : null;
  const authorized = local || BUILTIN_IDENTITIES[email] || metadataIdentity;
  const role = String(authorized?.role || '').toLowerCase();
  if (!authorized || !['admin', 'technician', 'handwerker', 'user'].includes(role)) return null;

  const { password: _password, ...safeUser } = authorized;
  return { ...safeUser, role, email, authEmail: email, supabaseUserId: authId };
}

export function readAuthorizedUsers(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem('qtool_users_v2') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
