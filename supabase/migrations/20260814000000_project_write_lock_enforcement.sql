-- QTool-Test only: enforce the project owner lease at the database boundary.
-- DO NOT apply to production without a separately reviewed release migration.

BEGIN;

ALTER TABLE public.project_sessions
  ADD COLUMN IF NOT EXISTS owner_user_id UUID,
  ADD COLUMN IF NOT EXISTS client_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS project_sessions_unique_active_project
  ON public.project_sessions (open_project_id)
  WHERE open_project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.qtool_privileged_mutation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  actor_uid UUID,
  actor_role TEXT NOT NULL,
  operation TEXT NOT NULL,
  reason TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON public.qtool_privileged_mutation_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.qtool_privileged_mutation_audit TO service_role;

CREATE OR REPLACE FUNCTION public.qtool_request_session_token()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT nullif(
    coalesce(
      (nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-qtool-session-token'),
      current_setting('request.jwt.claim.qtool_session_token', true)
    ),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION public.qtool_has_project_write_lock(p_project_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_project_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND public.qtool_request_session_token() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.project_sessions s
       WHERE s.open_project_id = p_project_id
         AND s.session_token = public.qtool_request_session_token()
         AND s.owner_user_id = auth.uid()
     )
$$;

REVOKE ALL ON FUNCTION public.qtool_request_session_token() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qtool_has_project_write_lock(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qtool_request_session_token() TO authenticated;
GRANT EXECUTE ON FUNCTION public.qtool_has_project_write_lock(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.qtool_is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_profiles p
     WHERE p.id = auth.uid()
       AND p.is_active = true
       AND p.role = 'admin'
  )
$$;
REVOKE ALL ON FUNCTION public.qtool_is_active_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qtool_is_active_admin() TO authenticated;

-- Session tokens are bearer secrets. Browser roles may neither read nor mutate
-- the lease table directly; they receive redacted status through the RPC below.
REVOKE ALL ON public.project_sessions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_project_lock_status(
  p_project_id TEXT DEFAULT NULL,
  p_session_token TEXT DEFAULT NULL
)
RETURNS TABLE(
  open_project_id TEXT,
  mode TEXT,
  device_type TEXT,
  lock_owner TEXT,
  locked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  is_owner BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.open_project_id,
         s.mode,
         coalesce(nullif(split_part(s.device, ':', 1), ''), 'Gerät'),
         coalesce(nullif(split_part(s.device, ':', 3), ''), 'Unbekannt'),
         s.created_at,
         s.last_seen,
         (s.owner_user_id = auth.uid()
          AND p_session_token IS NOT NULL
          AND s.session_token = p_session_token)
    FROM public.project_sessions s
   WHERE auth.uid() IS NOT NULL
     AND s.open_project_id IS NOT NULL
     AND (p_project_id IS NULL OR s.open_project_id = p_project_id)
$$;
REVOKE ALL ON FUNCTION public.get_project_lock_status(TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_lock_status(TEXT,TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.acquire_project_lock(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.acquire_project_lock(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public.acquire_project_lock(
  p_project_id TEXT,
  p_session_token TEXT,
  p_user_id TEXT,
  p_user_name TEXT,
  p_device TEXT,
  p_client_id TEXT DEFAULT NULL
)
RETURNS TABLE(acquired BOOLEAN, lock_owner TEXT, locked_at TIMESTAMPTZ, last_seen_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner public.project_sessions%ROWTYPE;
  v_request_session public.project_sessions%ROWTYPE;
  v_request_uid UUID := coalesce(
    auth.uid(),
    case
      when p_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_user_id::uuid
      when p_session_token IS NOT NULL AND length(p_session_token) >= 20 then md5(p_session_token)::uuid
      else NULL
    end
  );
  v_request_is_ipad BOOLEAN := split_part(coalesce(p_device, ''), ':', 1) = 'iPad';
BEGIN
  IF v_request_uid IS NULL OR p_session_token IS NULL OR length(p_session_token) < 20 THEN
    RAISE EXCEPTION 'LOCK_AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  -- p_user_id is retained only for backwards-compatible display metadata.
  -- Authorization and ownership always come from the verified JWT.
  IF NOT EXISTS (SELECT 1 FROM public.damage_reports WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'UNKNOWN_PROJECT' USING ERRCODE = '23503';
  END IF;

  -- A session may never abandon project A implicitly while opening project B.
  -- The strict exit barrier must release A explicitly after full confirmation.
  SELECT * INTO v_request_session FROM public.project_sessions
   WHERE session_token = p_session_token FOR UPDATE;
  IF FOUND AND v_request_session.open_project_id IS NOT NULL
     AND v_request_session.open_project_id IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'SESSION_ALREADY_OWNS_PROJECT:%', v_request_session.open_project_id
      USING ERRCODE = '55000';
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
    -- A valid offline owner never expires by elapsed time. Recovery from an
    -- abandoned device is a separate, audited administrative operation; a
    -- normal opener can never take over and overwrite durable offline work.
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
    open_project_id = excluded.open_project_id, mode = excluded.mode,
    device = excluded.device, last_seen = excluded.last_seen,
    owner_user_id = excluded.owner_user_id, client_id = excluded.client_id,
    created_at = CASE WHEN project_sessions.open_project_id IS DISTINCT FROM excluded.open_project_id
                      THEN now() ELSE project_sessions.created_at END;
  RETURN QUERY SELECT true, p_user_name, now(), now();
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_project_lock(p_project_id TEXT, p_session_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.project_sessions SET last_seen = now()
   WHERE open_project_id = p_project_id AND session_token = p_session_token
     AND owner_user_id = auth.uid();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_project_lock(p_project_id TEXT, p_session_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count INTEGER;
BEGIN
  -- Called only after the strict exit barrier has confirmed Supabase/Storage/OneDrive.
  UPDATE public.project_sessions SET open_project_id = NULL, last_seen = now()
   WHERE open_project_id = p_project_id AND session_token = p_session_token
     AND owner_user_id = auth.uid();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_project_lock(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_project_lock(TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_project_lock(TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_project_lock(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.renew_project_lock(TEXT,TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.release_project_lock(TEXT,TEXT) TO authenticated, anon, service_role;

-- New projects cannot satisfy an existing-project RLS policy yet. Creation and
-- first lease acquisition therefore happen atomically in this narrow RPC.
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
  v_uid UUID := auth.uid();
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
    RAISE EXCEPTION 'SESSION_ALREADY_OWNS_PROJECT:%', v_request_session.open_project_id
      USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.damage_reports WHERE id=p_project_id) THEN
    -- Retried saves from the exact same authenticated device session are
    -- idempotent. A different token or identity must never adopt the project.
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
    last_seen=excluded.last_seen, created_at=now(), owner_user_id=excluded.owner_user_id,
    client_id=excluded.client_id;
  RETURN jsonb_build_object('created', true, 'already_existed', false,
                            'project_id', p_project_id,
                            'offline_prepare_required', true);
END;
$$;
REVOKE ALL ON FUNCTION public.create_project_and_acquire_lock(TEXT,JSONB,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_project_and_acquire_lock(TEXT,JSONB,TEXT,TEXT,TEXT) TO authenticated;

-- Replace permissive authenticated mutation policies on every project-scoped table.
-- SELECT policies remain untouched: foreign sessions are deliberately read-only.
DO $policy_install$
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
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = v_table AND column_name = v_project_expr
    ) THEN
      RAISE EXCEPTION 'QTOOL_POLICY_PROJECT_COLUMN_MISSING: %.%', v_table, v_project_expr;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    FOR v_policy IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = v_table
         AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY qtool_owner_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.qtool_has_project_write_lock(%I::text))',
      v_table, v_project_expr);
    EXECUTE format(
      'CREATE POLICY qtool_owner_update ON public.%I FOR UPDATE TO authenticated USING (public.qtool_has_project_write_lock(%I::text)) WITH CHECK (public.qtool_has_project_write_lock(%I::text))',
      v_table, v_project_expr, v_project_expr);
    EXECUTE format(
      'CREATE POLICY qtool_owner_delete ON public.%I FOR DELETE TO authenticated USING (public.qtool_has_project_write_lock(%I::text))',
      v_table, v_project_expr);
  END LOOP;
END
$policy_install$;

-- Audit rows are generated by trusted database triggers/workers. Allowing a
-- browser to forge them would invalidate all write/readback evidence.
DO $audit_hardening$
DECLARE v_policy RECORD;
BEGIN
  IF to_regclass('public.damage_reports_audit') IS NOT NULL THEN
    ALTER TABLE public.damage_reports_audit ENABLE ROW LEVEL SECURITY;
    FOR v_policy IN SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename='damage_reports_audit'
        AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
    LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.damage_reports_audit', v_policy.policyname); END LOOP;
    REVOKE INSERT, UPDATE, DELETE ON public.damage_reports_audit FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
    FOR v_policy IN SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename='audit_log'
        AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
    LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_log', v_policy.policyname); END LOOP;
    REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM PUBLIC, anon, authenticated;
  END IF;
END
$audit_hardening$;

-- SYSTEM_SETTINGS is not a project and therefore never receives a project
-- lease. Keep its mutation path separate and admin-only without weakening any
-- normal damage_reports row.
DROP POLICY IF EXISTS qtool_system_settings_insert ON public.damage_reports;
DROP POLICY IF EXISTS qtool_system_settings_update ON public.damage_reports;
CREATE POLICY qtool_system_settings_insert ON public.damage_reports FOR INSERT TO authenticated
  WITH CHECK (id = 'SYSTEM_SETTINGS' AND public.qtool_is_active_admin());
CREATE POLICY qtool_system_settings_update ON public.damage_reports FOR UPDATE TO authenticated
  USING (id = 'SYSTEM_SETTINGS' AND public.qtool_is_active_admin())
  WITH CHECK (id = 'SYSTEM_SETTINGS' AND public.qtool_is_active_admin());

-- Inventory devices may be unassigned. Assignment/removal from a project is still
-- guarded by USING on the old owner and WITH CHECK on the new owner.
DO $device_policies$
DECLARE v_policy RECORD;
BEGIN
  IF to_regclass('public.devices') IS NULL THEN RETURN; END IF;
  FOR v_policy IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='devices' AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.devices', v_policy.policyname); END LOOP;
  CREATE POLICY qtool_device_insert ON public.devices FOR INSERT TO authenticated
    WITH CHECK (current_report_id IS NULL OR public.qtool_has_project_write_lock(current_report_id::text));
  CREATE POLICY qtool_device_update ON public.devices FOR UPDATE TO authenticated
    USING (current_report_id IS NULL OR public.qtool_has_project_write_lock(current_report_id::text))
    WITH CHECK (current_report_id IS NULL OR public.qtool_has_project_write_lock(current_report_id::text));
  CREATE POLICY qtool_device_delete ON public.devices FOR DELETE TO authenticated
    USING (current_report_id IS NULL OR public.qtool_has_project_write_lock(current_report_id::text));
END
$device_policies$;

-- Storage writes derive the project id from the canonical cases/<project>/ path.
CREATE OR REPLACE FUNCTION public.qtool_storage_project_id(p_name TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) = 'cases'
      THEN nullif(split_part(p_name, '/', 2), '')
    WHEN split_part(p_name, '/', 1) LIKE 'TESTRUN\_%' ESCAPE '\'
      THEN nullif(split_part(p_name, '/', 2), '')
  END
$$;
REVOKE ALL ON FUNCTION public.qtool_storage_project_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qtool_storage_project_id(TEXT) TO authenticated;

DO $storage_policies$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN RETURN; END IF;
  -- Never remove unrelated Storage policies/buckets. Replace only policies
  -- owned by this migration.
  DROP POLICY IF EXISTS qtool_owner_storage_insert ON storage.objects;
  DROP POLICY IF EXISTS qtool_owner_storage_update ON storage.objects;
  DROP POLICY IF EXISTS qtool_owner_storage_delete ON storage.objects;
  CREATE POLICY qtool_owner_storage_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id='case-files' AND public.qtool_has_project_write_lock(public.qtool_storage_project_id(name)));
  CREATE POLICY qtool_owner_storage_update ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id='case-files' AND public.qtool_has_project_write_lock(public.qtool_storage_project_id(name)))
    WITH CHECK (bucket_id='case-files' AND public.qtool_has_project_write_lock(public.qtool_storage_project_id(name)));
  CREATE POLICY qtool_owner_storage_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id='case-files' AND public.qtool_has_project_write_lock(public.qtool_storage_project_id(name)));
END
$storage_policies$;

-- Existing privileged RPCs must not remain callable by browser roles until they
-- accept and verify the owner token. Workers use service_role and must write an
-- explicit qtool_privileged_mutation_audit row with reason + correlation id.
DO $rpc_revoke$
DECLARE v_proc regprocedure;
BEGIN
  FOR v_proc IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prosecdef
       AND p.proname IN (
         'enqueue_project_image_upload','complete_todo_with_successor',
         'sync_measurement_followup','delete_project_secure',
         'fn_complete_and_create_todo','fn_complete_todo_and_archive_project'
       )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_proc);
  END LOOP;
END
$rpc_revoke$;

NOTIFY pgrst, 'reload schema';
COMMIT;
