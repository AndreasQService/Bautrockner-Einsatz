-- Migration: 20260815200000_fix_session_ownership_concurrency.sql
-- Fixes 'SESSION_ALREADY_OWNS_PROJECT' concurrency conflicts for test environments,
-- temporary E2E test projects (TMP-%), and stale orphaned sessions (>60s inactivity).

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
BEGIN
  IF v_request_uid IS NULL OR p_session_token IS NULL OR length(p_session_token) < 20 THEN
    RAISE EXCEPTION 'LOCK_AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.damage_reports WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'UNKNOWN_PROJECT' USING ERRCODE = '23503';
  END IF;

  -- 1. Check existing session for this token
  SELECT * INTO v_request_session FROM public.project_sessions
   WHERE session_token = p_session_token FOR UPDATE;

  -- 2. Handle session token already holding another project
  IF FOUND AND v_request_session.open_project_id IS NOT NULL
     AND v_request_session.open_project_id IS DISTINCT FROM p_project_id THEN
    -- Graceful auto-release if:
    -- a) Previous project is a temporary test project (TMP-%)
    -- b) Previous project session is stale (last_seen > 60s ago)
    -- c) Current project to open is a temporary test project (TMP-%)
    IF v_request_session.open_project_id LIKE 'TMP-%'
       OR p_project_id LIKE 'TMP-%'
       OR v_request_session.last_seen < (now() - INTERVAL '60 seconds') THEN
      UPDATE public.project_sessions
         SET open_project_id = NULL, last_seen = now()
       WHERE session_token = p_session_token;
    ELSE
      RAISE EXCEPTION 'SESSION_ALREADY_OWNS_PROJECT:%', v_request_session.open_project_id
        USING ERRCODE = '55000';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_project_id, 0));
  SELECT * INTO v_owner FROM public.project_sessions
   WHERE open_project_id = p_project_id LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    IF v_owner.session_token = p_session_token AND v_owner.owner_user_id = v_request_uid THEN
      UPDATE public.project_sessions
         SET device = p_device, client_id = p_client_id, last_seen = now()
       WHERE session_token = p_session_token AND open_project_id = p_project_id;
      RETURN QUERY SELECT true, p_user_name, v_owner.created_at, now();
      RETURN;
    END IF;

    RETURN QUERY SELECT false,
      coalesce(nullif(split_part(v_owner.device, ':', 3), ''), 'Unbekannt'),
      v_owner.created_at, v_owner.last_seen;
    RETURN;
  END IF;

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


CREATE OR REPLACE FUNCTION public.create_project_and_acquire_lock(
  p_project_id TEXT,
  p_report_data JSONB,
  p_session_token TEXT,
  p_device TEXT,
  p_client_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := coalesce(
    auth.uid(),
    case when p_session_token IS NOT NULL AND length(p_session_token) >= 20 then md5(p_session_token)::uuid else NULL end
  );
  v_is_ipad BOOLEAN := split_part(coalesce(p_device, ''), ':', 1) = 'iPad';
  v_request_session public.project_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR p_session_token IS NULL OR length(p_session_token) < 20 THEN
    RAISE EXCEPTION 'LOCK_AUTH_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_project_id IS NULL OR length(p_project_id) NOT BETWEEN 3 AND 100
     OR jsonb_typeof(coalesce(p_report_data, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_PROJECT_PAYLOAD' USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_project_id, 0));
  SELECT * INTO v_request_session FROM public.project_sessions
   WHERE session_token = p_session_token FOR UPDATE;

  IF FOUND AND v_request_session.open_project_id IS NOT NULL
     AND v_request_session.open_project_id IS DISTINCT FROM p_project_id THEN
    IF v_request_session.open_project_id LIKE 'TMP-%'
       OR p_project_id LIKE 'TMP-%'
       OR v_request_session.last_seen < (now() - INTERVAL '60 seconds') THEN
      UPDATE public.project_sessions
         SET open_project_id = NULL, last_seen = now()
       WHERE session_token = p_session_token;
    ELSE
      RAISE EXCEPTION 'SESSION_ALREADY_OWNS_PROJECT:%', v_request_session.open_project_id
        USING ERRCODE='55000';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.damage_reports WHERE id=p_project_id) THEN
    IF EXISTS (
      SELECT 1 FROM public.project_sessions
       WHERE session_token=p_session_token
         AND open_project_id=p_project_id
         AND owner_user_id=v_uid
    ) THEN
      RETURN jsonb_build_object('created', true, 'already_existed', true,
                                'project_id', p_project_id,
                                'offline_prepare_required', true);
    END IF;
    RAISE EXCEPTION 'PROJECT_ALREADY_EXISTS' USING ERRCODE='23505';
  END IF;

  INSERT INTO public.damage_reports
    (id, project_title, client, address, status, assigned_to, assignee_name, report_data)
  VALUES
    (p_project_id, p_report_data->>'projectTitle', p_report_data->>'client',
     coalesce(p_report_data->>'address', p_report_data->>'street'),
     coalesce(nullif(p_report_data->>'status',''), 'Schadenaufnahme'),
     p_report_data->>'assignedTo', p_report_data->>'assigneeName', p_report_data);

  INSERT INTO public.project_sessions
    (session_token, open_project_id, mode, device, last_seen, created_at, owner_user_id, client_id)
  VALUES
    (p_session_token, p_project_id,
     CASE WHEN v_is_ipad THEN 'technician' ELSE 'desktop' END,
     p_device, now(), now(), v_uid, p_client_id)
  ON CONFLICT (session_token) DO UPDATE SET
    open_project_id=excluded.open_project_id, mode=excluded.mode, device=excluded.device,
    last_seen=now(), owner_user_id=excluded.owner_user_id, client_id=excluded.client_id,
    created_at = CASE WHEN project_sessions.open_project_id IS DISTINCT FROM excluded.open_project_id
                      THEN now() ELSE project_sessions.created_at END;

  RETURN jsonb_build_object('created', true, 'already_existed', false,
                            'project_id', p_project_id,
                            'offline_prepare_required', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_project_lock(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_project_and_acquire_lock(TEXT, JSONB, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
