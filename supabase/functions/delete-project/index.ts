import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info, x-qtool-session-token, x-qtool-project-id, x-qtool-correlation-id',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://aoxduqspiezzyqeqyzzl.supabase.co';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'sb_publishable_HZzncDQUEtA8XN6HhT0ysA_K-Ho2eEL';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 405
    });
  }

  try {
    // 1. Verify Authorization Header (JWT)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        code: 401,
        error: 'UNAUTHENTICATED',
        message: 'Anmeldung als Administrator erforderlich (401)'
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const jwt = authHeader.replace('Bearer ', '').trim();

    // 2. Validate JWT server-side
    const anonClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userError } = await anonClient.auth.getUser(jwt);

    if (userError || !userData?.user) {
      return new Response(JSON.stringify({
        success: false,
        code: 401,
        error: 'INVALID_JWT',
        message: 'Ungültige oder abgelaufene Supabase Auth-Sitzung (401)'
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const actorUid = userData.user.id;

    // 3. Service Role client for admin verification and protected RPC call
    const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false }
    });

    // 4. Verify Actor UID against app_admin_users
    const { data: adminUser, error: adminErr } = await serviceClient
      .from('app_admin_users')
      .select('auth_user_id, active')
      .eq('auth_user_id', actorUid)
      .eq('active', true)
      .maybeSingle();

    if (adminErr || !adminUser) {
      return new Response(JSON.stringify({
        success: false,
        code: 403,
        error: 'FORBIDDEN',
        message: 'Keine Administratorberechtigung für diesen Benutzer (403)'
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    // 5. Bind this destructive request to the exact active project owner.
    const body = await req.json().catch(() => ({}));
    const projectId = body.project_id;
    const headerProjectId = req.headers.get('x-qtool-project-id');
    const sessionToken = req.headers.get('x-qtool-session-token');
    const correlationId = req.headers.get('x-qtool-correlation-id') || crypto.randomUUID();

    if (!projectId || typeof projectId !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        code: 400,
        error: 'INVALID_PROJECT_ID',
        message: 'Ungültige oder fehlende Projekt-ID.'
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    if (headerProjectId !== projectId || !sessionToken || sessionToken.length < 20) {
      return new Response(JSON.stringify({
        success: false, code: 403, error: 'OWNER_SESSION_REQUIRED',
        message: 'Projekt-ID und aktive Besitzersitzung müssen exakt bestätigt sein.'
      }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 403 });
    }

    const { data: ownerSession, error: ownerError } = await serviceClient
      .from('project_sessions')
      .select('session_token,open_project_id,owner_user_id')
      .eq('open_project_id', projectId)
      .eq('session_token', sessionToken)
      .eq('owner_user_id', actorUid)
      .maybeSingle();
    if (ownerError || !ownerSession) {
      return new Response(JSON.stringify({
        success: false, code: 409, error: 'PROJECT_LOCK_NOT_OWNED',
        message: 'Das gesperrte Projekt gehört nicht dieser Benutzer-/Gerätesitzung.'
      }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 409 });
    }

    const { error: auditError } = await serviceClient.from('qtool_privileged_mutation_audit').insert({
      project_id: projectId,
      actor_uid: actorUid,
      actor_role: 'admin',
      operation: 'delete_project_secure',
      reason: 'explicit_owner_confirmed_project_delete',
      correlation_id: correlationId,
      details: { edge_function: 'delete-project', owner_session_verified: true },
    });
    if (auditError) throw new Error(`Lösch-Audit konnte nicht geschrieben werden: ${auditError.message}`);

    // 6. Invoke protected RPC only after owner/session audit succeeded.
    const { data: rpcRes, error: rpcErr } = await serviceClient.rpc('delete_project_secure', {
      p_project_id: projectId,
      p_actor_uid: actorUid
    });

    if (rpcErr || !rpcRes || rpcRes.success === false) {
      const isNotFound = rpcRes?.error === 'PROJECT_NOT_FOUND';
      const statusCode = isNotFound ? 404 : 500;
      const errMsg = rpcErr ? rpcErr.message : (rpcRes?.message || 'Datenbank-Löschfehler');

      return new Response(JSON.stringify({
        success: false,
        code: statusCode,
        error: rpcRes?.error || 'DB_ERROR',
        message: errMsg
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: statusCode
      });
    }

    const auditId = rpcRes.audit_id;
    const photos = rpcRes.photos || [];

    // 7. Server-side Storage Cleanup for project photos
    let storageStatus = 'completed';
    let storageErrorMsg = null;

    if (Array.isArray(photos) && photos.length > 0) {
      try {
        const filePaths = photos.map((p: any) => p.filename || `${projectId}/${p.name || 'photo.jpg'}`);
        const { error: stErr } = await serviceClient.storage.from('project-photos').remove(filePaths);
        if (stErr) {
          storageStatus = 'storage_pending';
          storageErrorMsg = stErr.message;
        }
      } catch (e: any) {
        storageStatus = 'storage_pending';
        storageErrorMsg = e.message;
      }

      // Update Audit status
      await serviceClient
        .from('project_deletion_audit')
        .update({
          status: storageStatus,
          error_message: storageErrorMsg
        })
        .eq('audit_id', auditId);
    } else {
      await serviceClient
        .from('project_deletion_audit')
        .update({ status: 'completed' })
        .eq('audit_id', auditId);
    }

    return new Response(JSON.stringify({
      success: true,
      code: 200,
      audit_id: auditId,
      project_id: projectId,
      status: storageStatus,
      message: storageStatus === 'storage_pending' 
        ? 'Projekt in Datenbank gelöscht; Storage-Bereinigung ausstehend (storage_pending).'
        : 'Projekt vollständig und dauerhaft gelöscht.'
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      code: 500,
      error: 'SERVER_ERROR',
      message: `Interner Serverfehler: ${err.message}`
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
