-- ======================================================================
-- SECURE DELETION ARCHITECTURE MIGRATION (TEST ENVIRONMENT)
-- ======================================================================

-- 1. PROTECTED ADMIN USERS TABLE
CREATE TABLE IF NOT EXISTS public.app_admin_users (
  auth_user_id UUID PRIMARY KEY,
  user_email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL DEFAULT 'system'
);

-- Revoke direct permissions from client roles (anon, authenticated)
REVOKE ALL ON public.app_admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.app_admin_users TO service_role;

-- 2. PERSISTENT PROJECT DELETION AUDIT TABLE
CREATE TABLE IF NOT EXISTS public.project_deletion_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  project_number TEXT,
  project_title TEXT,
  actor_uid UUID NOT NULL,
  actor_email TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rows_deleted_reports INT DEFAULT 0,
  rows_deleted_todos INT DEFAULT 0,
  rows_deleted_sessions INT DEFAULT 0,
  storage_paths_count INT DEFAULT 0,
  storage_paths JSONB,
  status TEXT NOT NULL CHECK (status IN ('started', 'db_deleted', 'completed', 'storage_pending', 'failed')),
  error_message TEXT
);

-- Revoke direct permissions from client roles
REVOKE ALL ON public.project_deletion_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.project_deletion_audit TO service_role;

-- 3. PROTECTED DATABASE FUNCTION FOR ATOMIC PROJECT DELETION
CREATE OR REPLACE FUNCTION public.delete_project_secure(
  p_project_id TEXT,
  p_actor_uid UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_report RECORD;
  v_audit_id UUID;
  v_todos_count INT := 0;
  v_sessions_count INT := 0;
  v_reports_count INT := 0;
  v_photos JSONB := '[]'::jsonb;
BEGIN
  -- 1. Server-side Admin Authorization Check against app_admin_users
  SELECT active INTO v_is_admin
  FROM public.app_admin_users
  WHERE auth_user_id = p_actor_uid AND active = true;

  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User % is not an authorized administrator.', p_actor_uid
      USING ERRCODE = '42501';
  END IF;

  -- 2. Lock and fetch target project metadata
  SELECT id, project_title, report_data INTO v_report
  FROM public.damage_reports
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PROJECT_NOT_FOUND',
      'message', format('Project ID %s not found in damage_reports', p_project_id)
    );
  END IF;

  -- Extract storage photos metadata if available
  IF v_report.report_data ? 'photos' THEN
    v_photos := v_report.report_data->'photos';
  END IF;

  -- 3. Create Audit Entry with status 'started'
  v_audit_id := gen_random_uuid();
  INSERT INTO public.project_deletion_audit (
    audit_id, project_id, project_number, project_title,
    actor_uid, deleted_at, storage_paths, status
  ) VALUES (
    v_audit_id, p_project_id,
    COALESCE(v_report.report_data->>'projectNumber', p_project_id),
    COALESCE(v_report.project_title, 'Unbenanntes Projekt'),
    p_actor_uid, NOW(), v_photos, 'started'
  );

  -- 4. Clean up child tables (project_todos, project_sessions)
  DELETE FROM public.project_todos WHERE project_id = p_project_id;
  GET DIAGNOSTICS v_todos_count = ROW_COUNT;

  DELETE FROM public.project_sessions WHERE open_project_id = p_project_id;
  GET DIAGNOSTICS v_sessions_count = ROW_COUNT;

  -- 5. Delete main damage_report row
  DELETE FROM public.damage_reports WHERE id = p_project_id;
  GET DIAGNOSTICS v_reports_count = ROW_COUNT;

  IF v_reports_count = 0 THEN
    RAISE EXCEPTION 'FAILED_DELETION: Primary row % could not be deleted', p_project_id;
  END IF;

  -- 6. Update Audit Entry to 'db_deleted'
  UPDATE public.project_deletion_audit
  SET
    rows_deleted_reports = v_reports_count,
    rows_deleted_todos = v_todos_count,
    rows_deleted_sessions = v_sessions_count,
    storage_paths_count = jsonb_array_length(v_photos),
    status = 'db_deleted'
  WHERE audit_id = v_audit_id;

  RETURN jsonb_build_object(
    'success', true,
    'audit_id', v_audit_id,
    'project_id', p_project_id,
    'rows_deleted_reports', v_reports_count,
    'rows_deleted_todos', v_todos_count,
    'rows_deleted_sessions', v_sessions_count,
    'storage_paths_count', jsonb_array_length(v_photos),
    'photos', v_photos,
    'status', 'db_deleted'
  );
EXCEPTION WHEN OTHERS THEN
  -- Automatic Rollback occurs for DB changes
  IF v_audit_id IS NOT NULL THEN
    -- Try recording failure state in audit if transaction allows
    BEGIN
      INSERT INTO public.project_deletion_audit (
        audit_id, project_id, actor_uid, deleted_at, status, error_message
      ) VALUES (
        v_audit_id, p_project_id, p_actor_uid, NOW(), 'failed', SQLERRM
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END BEGIN;
  END IF;
  RAISE;
END;
$$;

-- REVOKE EXECUTE FROM ALL PUBLIC ROLES FOR ABSOLUTE SECURITY
REVOKE EXECUTE ON FUNCTION public.delete_project_secure(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_project_secure(TEXT, UUID) TO service_role;
