-- Migration: 20260815190000_fix_rls_anon_write_lock_policies.sql
-- Fixes 'supabase_db_unconfirmed, content_exact_match_unconfirmed' during project exit/sync.
-- Enables RLS UPDATE, INSERT, and DELETE policies for both authenticated AND anon roles
-- whenever the active session holds the verified project write lock.

-- 1. Ensure project_sessions policies allow session maintenance for anon & authenticated
DROP POLICY IF EXISTS qtool_session_anon_insert ON public.project_sessions;
DROP POLICY IF EXISTS qtool_session_anon_update ON public.project_sessions;

CREATE POLICY qtool_session_anon_insert ON public.project_sessions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY qtool_session_anon_update ON public.project_sessions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. Update project business tables RLS policies to include anon role alongside authenticated
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
