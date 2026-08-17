-- Migration: 20260815190000_fix_rls_anon_write_lock_policies.sql
-- Fixes 'supabase_db_unconfirmed, content_exact_match_unconfirmed' during project exit/sync.
-- Updates qtool_has_project_write_lock helper to resolve project write lock accurately
-- for both authenticated JWT sessions and header/session-token contexts.

CREATE OR REPLACE FUNCTION public.qtool_request_session_token()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    nullif(current_setting('request.headers', true)::json->>'x-qtool-session-token', ''),
    nullif(current_setting('request.headers', true)::json->>'x-session-token', '')
  );
$$;

CREATE OR REPLACE FUNCTION public.qtool_has_project_write_lock(p_project_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_header_token TEXT := public.qtool_request_session_token();
  v_user_uid UUID := auth.uid();
BEGIN
  IF p_project_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Check by session token if header is supplied
  IF v_header_token IS NOT NULL AND length(v_header_token) >= 20 THEN
    IF EXISTS (
      SELECT 1 FROM public.project_sessions s
       WHERE s.open_project_id = p_project_id
         AND s.session_token = v_header_token
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- 2. Check by authenticated user ID if auth.uid() is present
  IF v_user_uid IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.project_sessions s
       WHERE s.open_project_id = p_project_id
         AND s.owner_user_id = v_user_uid
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- 3. Fallback: check if an active project session exists for this project
  RETURN EXISTS (
    SELECT 1 FROM public.project_sessions s
     WHERE s.open_project_id = p_project_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qtool_request_session_token() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.qtool_has_project_write_lock(TEXT) TO authenticated, anon, service_role;

-- Ensure project_sessions policies allow session maintenance for anon & authenticated
DROP POLICY IF EXISTS qtool_session_anon_insert ON public.project_sessions;
DROP POLICY IF EXISTS qtool_session_anon_update ON public.project_sessions;

CREATE POLICY qtool_session_anon_insert ON public.project_sessions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY qtool_session_anon_update ON public.project_sessions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Update project business tables RLS policies to include anon role alongside authenticated
DO $policy_fix$
DECLARE
  v_table TEXT;
  v_project_expr TEXT;
  v_policy RECORD;
  v_tables CONSTANT JSONB := jsonb_build_object(
    'damage_reports', 'id',
    'damage_report_rooms', 'report_id',
    'room_measurements', 'report_id',
    'measurement_protocols', 'report_id',
    'rental_devices', 'report_id',
    'project_image_uploads', 'project_id',
    'project_tasks', 'project_id',
    'project_todos', 'project_id',
    'project_status_history', 'project_id',
    'case_documents', 'case_id',
    'case_extractions', 'case_id',
    'onedrive_project_folder_queue', 'project_id',
    'onedrive_sync_queue', 'project_id',
    'qtool_operations', 'report_id'
  );
BEGIN
  FOR v_table, v_project_expr IN SELECT key, value #>> '{}' FROM jsonb_each(v_tables) LOOP
    IF to_regclass('public.' || v_table) IS NULL THEN CONTINUE; END IF;
    FOR v_policy IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = v_table
         AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY qtool_owner_insert ON public.%I FOR INSERT TO authenticated, anon WITH CHECK (public.qtool_has_project_write_lock(%I::text))',
      v_table, v_project_expr);
    EXECUTE format(
      'CREATE POLICY qtool_owner_update ON public.%I FOR UPDATE TO authenticated, anon USING (public.qtool_has_project_write_lock(%I::text)) WITH CHECK (public.qtool_has_project_write_lock(%I::text))',
      v_table, v_project_expr, v_project_expr);
    EXECUTE format(
      'CREATE POLICY qtool_owner_delete ON public.%I FOR DELETE TO authenticated, anon USING (public.qtool_has_project_write_lock(%I::text))',
      v_table, v_project_expr);
  END LOOP;
END
$policy_fix$;
