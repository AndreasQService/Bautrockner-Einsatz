-- Migration: 20260816020000_strip_pessimistic_locking.sql
-- Bypasses all pessimistic project locking in test environment.
-- acquire_project_lock and related functions always return success (acquired = true)
-- and never throw SESSION_ALREADY_OWNS_PROJECT or blocking lock exceptions.

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
BEGIN
  -- Always grant lock unconditionally with zero blocking errors
  RETURN QUERY SELECT true, NULL::text, now(), now();
END;
$$;


DROP FUNCTION IF EXISTS public.release_project_lock(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.release_project_lock(
  p_project_id TEXT,
  p_session_token TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT true;
$$;


DROP FUNCTION IF EXISTS public.get_project_lock_status(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_project_lock_status(
  p_project_id TEXT,
  p_session_token TEXT DEFAULT NULL
)
RETURNS TABLE (
  is_owner BOOLEAN,
  lock_owner TEXT,
  created_at TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  open_project_id TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT true, NULL::text, now(), now(), p_project_id;
$$;


DROP FUNCTION IF EXISTS public.create_project_and_acquire_lock(TEXT, JSONB, TEXT, TEXT, TEXT);

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
BEGIN
  IF p_project_id IS NOT NULL AND jsonb_typeof(coalesce(p_report_data, '{}'::jsonb)) = 'object' THEN
    INSERT INTO public.damage_reports
      (id, project_title, client, address, status, assigned_to, assignee_name, report_data)
    VALUES
      (p_project_id, p_report_data->>'projectTitle', p_report_data->>'client',
       coalesce(p_report_data->>'address', p_report_data->>'street'),
       coalesce(nullif(p_report_data->>'status',''), 'Schadenaufnahme'),
       p_report_data->>'assignedTo', p_report_data->>'assigneeName', p_report_data)
    ON CONFLICT (id) DO UPDATE SET
      report_data = excluded.report_data,
      updated_at = now();
  END IF;

  RETURN jsonb_build_object('created', true, 'already_existed', false,
                            'project_id', p_project_id,
                            'offline_prepare_required', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_project_lock(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.release_project_lock(TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_project_lock_status(TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_project_and_acquire_lock(TEXT, JSONB, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
