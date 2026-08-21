import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info, x-qtool-session-token',
  'Content-Type': 'application/json',
};

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), { status, headers: CORS_HEADERS });

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeName = (value: unknown) => String(value || '').trim();
const ALLOWED_ROLES = new Set(['admin', 'technician', 'handwerker', 'user']);
const normalizeRole = (value: unknown) => String(value || '').trim().toLowerCase();

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization') || '';
  if (!supabaseUrl || !anonKey || !serviceKey || !authorization.startsWith('Bearer ')) {
    return json(401, { ok: false, error: 'Nicht authentifiziert.' });
  }

  const token = authorization.slice('Bearer '.length);
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json(401, { ok: false, error: 'Sitzung ungültig.' });

  const { data: callerProfile } = await service
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (!callerProfile?.is_active) return json(403, { ok: false, error: 'Benutzer ist nicht aktiv.' });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Ungültige Anfrage.' });
  }
  const action = String(body.action || '');

  // The directory contains personal data (including email addresses), so reads
  // and mutations must share the same server-side administrator boundary.
  if (callerProfile.role !== 'admin') {
    return json(403, { ok: false, error: 'Administratorrechte erforderlich.' });
  }

  if (action === 'list') {
    const { data: profiles, error: profileError } = await service
      .from('user_profiles')
      .select('id, display_name, role, is_active')
      .eq('is_active', true)
      .order('display_name');
    if (profileError) return json(500, { ok: false, error: profileError.message });

    const { data: authUsers, error: listError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) return json(500, { ok: false, error: listError.message });
    const emailById = new Map((authUsers.users || []).map((user) => [user.id, user.email || '']));
    const users = (profiles || []).map((profile) => ({
      id: profile.id,
      email: emailById.get(profile.id) || '',
      displayName: profile.display_name,
      role: profile.role,
      isActive: profile.is_active,
    })).filter((user) => user.email);
    return json(200, { ok: true, users });
  }

  if (action === 'delete') {
    const userId = String(body.userId || '');
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json(400, { ok: false, error: 'Ungültige Benutzer-ID.' });
    if (userId === authData.user.id) return json(400, { ok: false, error: 'Das eigene Konto kann nicht gelöscht werden.' });

    const { data: targetProfile, error: targetProfileError } = await service
      .from('user_profiles')
      .select('id, is_active')
      .eq('id', userId)
      .maybeSingle();
    if (targetProfileError || !targetProfile) return json(404, { ok: false, error: 'Benutzer wurde nicht gefunden.' });

    const { error: deactivateError } = await service.from('user_profiles').update({ is_active: false }).eq('id', userId);
    if (deactivateError) return json(500, { ok: false, error: 'Benutzer konnte nicht deaktiviert werden.' });

    const { error: deleteAuthError } = await service.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      await service.from('user_profiles').update({ is_active: targetProfile.is_active }).eq('id', userId);
      return json(500, { ok: false, error: 'Benutzerkonto konnte nicht gelöscht werden.' });
    }
    await service.from('user_profiles').delete().eq('id', userId);
    return json(200, { ok: true });
  }

  const email = normalizeEmail(body.email);
  const displayName = normalizeName(body.displayName);
  const password = String(body.password || '');
  const role = normalizeRole(body.role);
  if (!email.includes('@') || !displayName) return json(400, { ok: false, error: 'E-Mail und Anzeigename sind erforderlich.' });
  if (!ALLOWED_ROLES.has(role)) return json(400, { ok: false, error: 'Ungültige Rolle.' });

  if (action === 'create') {
    if (password.length < 8) return json(400, { ok: false, error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' });
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        qtool_role: role,
        qtool_display_name: displayName,
      },
    });
    if (createError || !created.user) return json(400, { ok: false, error: createError?.message || 'Benutzer konnte nicht angelegt werden.' });

    const { error: profileError } = await service.from('user_profiles').insert({
      id: created.user.id,
      display_name: displayName,
      role,
      is_active: true,
    });
    if (profileError) {
      await service.auth.admin.deleteUser(created.user.id);
      return json(500, { ok: false, error: 'Benutzerprofil konnte nicht angelegt werden.' });
    }
    return json(200, { ok: true });
  }

  if (action === 'update') {
    const userId = String(body.userId || '');
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json(400, { ok: false, error: 'Ungültige Benutzer-ID.' });
    if (password && password.length < 8) return json(400, { ok: false, error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' });

    const { data: existingAuth, error: existingAuthError } = await service.auth.admin.getUserById(userId);
    if (existingAuthError || !existingAuth.user) {
      return json(404, { ok: false, error: 'Benutzer wurde nicht gefunden.' });
    }
    const { data: existingProfile, error: existingProfileError } = await service
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (existingProfileError || !existingProfile) {
      return json(404, { ok: false, error: 'Benutzerprofil wurde nicht gefunden.' });
    }
    if (userId === authData.user.id && role !== 'admin') {
      return json(400, { ok: false, error: 'Die eigene Administratorrolle kann nicht entfernt werden.' });
    }
    const authChanges: { email: string; password?: string; app_metadata: Record<string, unknown> } = {
      email,
      app_metadata: {
        ...(existingAuth.user.app_metadata || {}),
        qtool_role: role,
        qtool_display_name: displayName,
      },
    };
    if (password) authChanges.password = password;
    const { error: updateAuthError } = await service.auth.admin.updateUserById(userId, authChanges);
    if (updateAuthError) return json(400, { ok: false, error: updateAuthError.message });
    const { error: updateProfileError } = await service
      .from('user_profiles')
      .update({ display_name: displayName, role, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (updateProfileError) return json(500, { ok: false, error: updateProfileError.message });
    return json(200, { ok: true });
  }

  return json(400, { ok: false, error: 'Unbekannte Aktion.' });
});
