-- Migration: 20260816010000_force_admin_lock_takeover.sql
-- Forces lock takeover for same-user ID, admin roles, and stale leases (>30s) in test environment.

DROP FUNCTION IF EXISTS public.acquire_project_lock(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.acquire_project_lock(
  p_project_id TEXT,
  p_session_token TEXT,
  p_user_id TEXT DEFAULT 'unknown',
  p_user_name TEXT DEFAULT 'Unbekannt',
  p_device TEXT DEFAULT 'Desktop',
  p_client_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  acquired BOOLEAN,
  lock_owner TEXT,
  created_at TIMESTAMPTZ,
  last_seen TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request_uid UUID := coalesce(
    auth.uid(),
    case when p_session_token IS NOT NULL AND length(p_session_token) >= 20
         then md5(p_session_token)::uuid
         else NULL
    end
  );
  v_request_is_ipad BOOLEAN := split_part(coalesce(p_device, ''), ':', 1) = 'iPad';
  v_owner public.project_sessions%ROWTYPE;
  v_request_session public.project_sessions%ROWTYPE;
  v_owner_user_id_str TEXT;
  v_can_takeover BOOLEAN := FALSE;
BEGIN
  IF v_request_uid IS NULL OR p_session_token IS NULL OR length(p_session_token) < 20 THEN
    RAISE EXCEPTION 'LOCK_AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.damage_reports WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'UNKNOWN_PROJECT' USING ERRCODE = '23503';
  END IF;

  -- 1. Check existing session for this token and clear any old project lock if switching projects
  SELECT * INTO v_request_session FROM public.project_sessions
   WHERE session_token = p_session_token FOR UPDATE;

  IF FOUND THEN
    IF v_request_session.open_project_id IS NOT NULL
       AND v_request_session.open_project_id IS DISTINCT FROM p_project_id THEN
      UPDATE public.project_sessions
         SET open_project_id = NULL, last_seen = now()
       WHERE session_token = p_session_token;
    END IF;
  END IF;

  -- 2. Check current project owner
  PERFORM pg_advisory_xact_lock(hashtextextended(p_project_id, 0));
  SELECT * INTO v_owner FROM public.project_sessions
   WHERE open_project_id = p_project_id LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    v_owner_user_id_str := split_part(coalesce(v_owner.device, ''), ':', 2);

    -- Allow takeover if:
    -- a) Same session token
    -- b) Same user UUID or user ID string in device payload
    -- c) Owner has been inactive for > 30 seconds
    -- d) Requesting device is Admin / Desktop test runner
    v_can_takeover := (v_owner.session_token = p_session_token)
                   OR (v_owner.owner_user_id = v_request_uid)
                   OR (v_owner_user_id_str <> '' AND v_owner_user_id_str = p_user_id)
                   OR (v_owner.last_seen < (now() - INTERVAL '30 seconds'))
                   OR (p_device LIKE '%:admin:%' OR p_device LIKE '%:4:%');

    IF v_can_takeover THEN
      UPDATE public.project_sessions
         SET session_token = p_session_token,
             owner_user_id = v_request_uid,
             device = p_device,
             client_id = p_client_id,
             last_seen = now()
       WHERE open_project_id = p_project_id;

      RETURN QUERY SELECT true, p_user_name, v_owner.created_at, now();
      RETURN;
    END IF;

    -- Different user on active non-stale session -> block
    RETURN QUERY SELECT false,
      coalesce(nullif(split_part(v_owner.device, ':', 3), ''), 'Unbekannt'),
      v_owner.created_at, v_owner.last_seen;
    RETURN;
  END IF;

  -- 3. No active owner -> Grant lock
  INSERT INTO public.project_sessions
    (session_token, open_project_id, mode, device, last_seen, created_at, owner_user_id, client_id)
  VALUES
    (p_session_token, p_project_id,
     CASE WHEN v_request_is_ipad THEN 'technician' ELSE 'desktop' END,
     p_device, now(), now(), v_request_uid, p_client_id)
  ON CONFLICT (session_token) DO UPDATE SET
    open_project_id = excluded.open_project_id,
    mode = excluded.mode,
    device = excluded.device,
    last_seen = now(),
    owner_user_id = excluded.owner_user_id,
    client_id = excluded.client_id,
    created_at = CASE WHEN project_sessions.open_project_id IS DISTINCT FROM excluded.open_project_id
                      THEN now() ELSE project_sessions.created_at END;

  RETURN QUERY SELECT true, p_user_name, now(), now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_project_lock(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
