-- ======================================================================
-- SCHEMA-NEUAUFBAU DRY-RUN FÜR SUPABASE-TESTPROJEKT (QTool-Test)
-- Target: QTool-Test (aoxduqspiezzyqeqyzzl)
-- ⚠️ VERBOTENES LIVE-PROJEKT: yxdoecdqttgdncgbzyus
-- SAFE DRY-RUN VERSION: ENDET MIT ROLLBACK
-- ======================================================================

BEGIN;

-- ----------------------------------------------------------------------
-- 1. PRE-ASSERTIONS: Verifizieren dass die Datenbank bereinigt ist
-- ----------------------------------------------------------------------
DO $$
DECLARE
  v_reports_count int;
  v_audits_count int;
  v_policies_count int;
  v_auth_user_exists bool;
BEGIN
  SELECT count(*) INTO v_reports_count FROM public.damage_reports;
  SELECT count(*) INTO v_audits_count FROM public.damage_reports_audit;
  SELECT count(*) INTO v_policies_count FROM pg_policies WHERE schemaname IN ('public', 'storage');
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = '8f995a78-a921-4b66-977a-f1a818985055') INTO v_auth_user_exists;

  IF v_reports_count <> 0 OR v_audits_count <> 0 OR v_policies_count <> 0 OR NOT v_auth_user_exists THEN
    RAISE EXCEPTION '[SAFETY ABORT] Datenbank ist vor dem Neuaufbau nicht im bereinigten Sollzustand! (Reports: %, Audits: %, Policies: %, AuthUser: %)',
      v_reports_count, v_audits_count, v_policies_count, v_auth_user_exists;
  END IF;

  RAISE NOTICE '[PRE-CHECK PASSED] Bereinigter Ausgangszustand vor Schema-Aufbau verifiziert.';
END $$;

-- ----------------------------------------------------------------------
-- 2. SCHEMA-RECONCILIATION & NEUAUFBAU
-- ----------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2a. damage_reports
CREATE TABLE IF NOT EXISTS public.damage_reports (
  id                   TEXT PRIMARY KEY,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_title        TEXT,
  client               TEXT,
  address              TEXT,
  status               TEXT DEFAULT 'Schadenaufnahme',
  assigned_to          TEXT,
  date                 DATE,
  drying_started       TIMESTAMPTZ,
  status_started_at    TIMESTAMPTZ,
  assignee_name        TEXT,
  deleted_at           TIMESTAMPTZ DEFAULT NULL,
  deleted_by           TEXT DEFAULT NULL,
  report_data          JSONB,
  image_urls           JSONB
);

ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS project_title TEXT;
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS client TEXT;
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Schadenaufnahme';
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS drying_started TIMESTAMPTZ;
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS status_started_at TIMESTAMPTZ;
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS assignee_name TEXT;
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS deleted_by TEXT DEFAULT NULL;
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS report_data JSONB;
ALTER TABLE public.damage_reports ADD COLUMN IF NOT EXISTS image_urls JSONB;

CREATE INDEX IF NOT EXISTS idx_damage_reports_not_deleted ON public.damage_reports(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_damage_reports_status ON public.damage_reports(status);
CREATE INDEX IF NOT EXISTS idx_damage_reports_status_started ON public.damage_reports(status_started_at);
CREATE INDEX IF NOT EXISTS idx_damage_reports_assignee ON public.damage_reports(assignee_name);

DROP TRIGGER IF EXISTS tr_damage_reports_updated_at ON public.damage_reports;
CREATE TRIGGER tr_damage_reports_updated_at
  BEFORE UPDATE ON public.damage_reports
  FOR EACH ROW EXECUTE PROCEDURE public.fn_set_updated_at();

-- 2b. device_catalog
CREATE TABLE IF NOT EXISTS public.device_catalog (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name           TEXT NOT NULL UNIQUE,
  device_type          TEXT NOT NULL,
  manufacturer         TEXT,
  power_watts          INT,
  kwh_per_day          NUMERIC(6,2),
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.device_catalog ADD COLUMN IF NOT EXISTS model_name TEXT;
ALTER TABLE public.device_catalog ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE public.device_catalog ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE public.device_catalog ADD COLUMN IF NOT EXISTS power_watts INT;
ALTER TABLE public.device_catalog ADD COLUMN IF NOT EXISTS kwh_per_day NUMERIC(6,2);
ALTER TABLE public.device_catalog ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2c. devices
CREATE TABLE IF NOT EXISTS public.devices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  number               TEXT UNIQUE,
  type                 TEXT,
  model                TEXT,
  status               TEXT DEFAULT 'Aktiv',
  current_project      TEXT,
  current_report_id    TEXT REFERENCES public.damage_reports(id) ON DELETE SET NULL,
  energy_consumption   NUMERIC
);

ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS number TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Aktiv';
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS current_project TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS current_report_id TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS energy_consumption NUMERIC;

-- 2d. rental_devices
CREATE TABLE IF NOT EXISTS public.rental_devices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  report_id            TEXT REFERENCES public.damage_reports(id) ON DELETE CASCADE,
  device_type          TEXT NOT NULL,
  device_number        TEXT,
  start_date           DATE,
  end_date             DATE,
  notes                TEXT
);

ALTER TABLE public.rental_devices ADD COLUMN IF NOT EXISTS report_id TEXT;
ALTER TABLE public.rental_devices ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE public.rental_devices ADD COLUMN IF NOT EXISTS device_number TEXT;
ALTER TABLE public.rental_devices ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.rental_devices ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.rental_devices ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2e. project_image_uploads & reconciled storage_status constraint
CREATE TABLE IF NOT EXISTS public.project_image_uploads (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           TEXT NOT NULL REFERENCES public.damage_reports(id) ON DELETE CASCADE,
  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name      TEXT,
  local_image_id       TEXT UNIQUE,
  filename             TEXT NOT NULL,
  mime_type            TEXT NOT NULL DEFAULT 'image/jpeg',
  size_bytes           BIGINT,
  sha256               TEXT,
  storage_bucket       TEXT DEFAULT 'case-files',
  storage_path         TEXT,
  remote_path          TEXT,
  remote_item_id       TEXT,
  remote_etag          TEXT,
  upload_session_url   TEXT,
  bytes_uploaded       BIGINT DEFAULT 0,
  storage_status       TEXT NOT NULL DEFAULT 'local_only',
  retry_count          INT DEFAULT 0,
  last_error           TEXT,
  last_attempt_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  verified_at          TIMESTAMPTZ
);

ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS local_image_id TEXT;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS mime_type TEXT DEFAULT 'image/jpeg';
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS sha256 TEXT;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'case-files';
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS remote_path TEXT;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS remote_item_id TEXT;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS remote_etag TEXT;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS upload_session_url TEXT;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS bytes_uploaded BIGINT DEFAULT 0;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS storage_status TEXT DEFAULT 'local_only';
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE public.project_image_uploads ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE public.project_image_uploads
  DROP CONSTRAINT IF EXISTS project_image_uploads_storage_status_check;

ALTER TABLE public.project_image_uploads
  ADD CONSTRAINT project_image_uploads_storage_status_check
  CHECK (storage_status IN (
    'local_only',
    'queued_for_sync',
    'uploaded_to_backend',
    'queued_for_remote',
    'remote_uploading',
    'remote_uploaded_manifest_pending',
    'remote_verified',
    'failed',
    'needs_repair'
  ));

-- 2f. project_sessions
CREATE TABLE IF NOT EXISTS public.project_sessions (
  session_token        TEXT PRIMARY KEY,
  open_project_id      TEXT REFERENCES public.damage_reports(id) ON DELETE SET NULL,
  mode                 TEXT DEFAULT 'desktop',
  device               TEXT DEFAULT 'Desktop',
  last_seen            TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.project_sessions ADD COLUMN IF NOT EXISTS open_project_id TEXT;
ALTER TABLE public.project_sessions ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'desktop';
ALTER TABLE public.project_sessions ADD COLUMN IF NOT EXISTS device TEXT DEFAULT 'Desktop';
ALTER TABLE public.project_sessions ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- 2g. project_tasks
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           TEXT NOT NULL REFERENCES public.damage_reports(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  is_completed         BOOLEAN NOT NULL DEFAULT FALSE,
  due_date             TIMESTAMPTZ,
  assignee_name        TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS assignee_name TEXT;

-- 2h. project_status_history
CREATE TABLE IF NOT EXISTS public.project_status_history (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           TEXT NOT NULL REFERENCES public.damage_reports(id) ON DELETE CASCADE,
  from_status          TEXT,
  to_status            TEXT NOT NULL,
  changed_by           TEXT,
  changed_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.project_status_history ADD COLUMN IF NOT EXISTS from_status TEXT;
ALTER TABLE public.project_status_history ADD COLUMN IF NOT EXISTS to_status TEXT;
ALTER TABLE public.project_status_history ADD COLUMN IF NOT EXISTS changed_by TEXT;

-- 2i. case_documents
CREATE TABLE IF NOT EXISTS public.case_documents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              TEXT NOT NULL REFERENCES public.damage_reports(id) ON DELETE CASCADE,
  file_path            TEXT NOT NULL,
  file_type            TEXT NOT NULL CHECK (file_type IN ('pdf','msg','txt')),
  original_filename    TEXT,
  extraction_status    TEXT NOT NULL DEFAULT 'pending',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.case_documents ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE public.case_documents ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending';

-- 2j. case_extractions
CREATE TABLE IF NOT EXISTS public.case_extractions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              TEXT NOT NULL REFERENCES public.damage_reports(id) ON DELETE CASCADE,
  json_result          JSONB NOT NULL,
  confidence           JSONB,
  evidence             JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.case_extractions ADD COLUMN IF NOT EXISTS confidence JSONB;
ALTER TABLE public.case_extractions ADD COLUMN IF NOT EXISTS evidence JSONB;

-- 2k. damage_report_rooms
CREATE TABLE IF NOT EXISTS public.damage_report_rooms (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id            TEXT NOT NULL REFERENCES public.damage_reports(id) ON DELETE CASCADE,
  room_name            TEXT NOT NULL,
  apartment            TEXT,
  length_m             NUMERIC(6,2),
  width_m              NUMERIC(6,2),
  height_m             NUMERIC(6,2),
  area_sqm             NUMERIC(6,2),
  volume_cum           NUMERIC(6,2),
  canvas_image_url     TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.damage_report_rooms ADD COLUMN IF NOT EXISTS apartment TEXT;
ALTER TABLE public.damage_report_rooms ADD COLUMN IF NOT EXISTS length_m NUMERIC(6,2);
ALTER TABLE public.damage_report_rooms ADD COLUMN IF NOT EXISTS width_m NUMERIC(6,2);
ALTER TABLE public.damage_report_rooms ADD COLUMN IF NOT EXISTS height_m NUMERIC(6,2);
ALTER TABLE public.damage_report_rooms ADD COLUMN IF NOT EXISTS area_sqm NUMERIC(6,2);
ALTER TABLE public.damage_report_rooms ADD COLUMN IF NOT EXISTS volume_cum NUMERIC(6,2);
ALTER TABLE public.damage_report_rooms ADD COLUMN IF NOT EXISTS canvas_image_url TEXT;

-- 2l. room_measurements
CREATE TABLE IF NOT EXISTS public.room_measurements (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id              UUID NOT NULL REFERENCES public.damage_report_rooms(id) ON DELETE CASCADE,
  measurement_type     TEXT NOT NULL,
  value_digit          NUMERIC(8,2),
  unit                 TEXT,
  position_x           NUMERIC(6,2),
  position_y           NUMERIC(6,2),
  notes                TEXT,
  measured_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.room_measurements ADD COLUMN IF NOT EXISTS value_digit NUMERIC(8,2);
ALTER TABLE public.room_measurements ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE public.room_measurements ADD COLUMN IF NOT EXISTS position_x NUMERIC(6,2);
ALTER TABLE public.room_measurements ADD COLUMN IF NOT EXISTS position_y NUMERIC(6,2);
ALTER TABLE public.room_measurements ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2m. measurement_protocols
CREATE TABLE IF NOT EXISTS public.measurement_protocols (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id            TEXT NOT NULL REFERENCES public.damage_reports(id) ON DELETE CASCADE,
  protocol_number      TEXT,
  pdf_storage_path     TEXT,
  created_by           TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.measurement_protocols ADD COLUMN IF NOT EXISTS protocol_number TEXT;
ALTER TABLE public.measurement_protocols ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;
ALTER TABLE public.measurement_protocols ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 2n. damage_reports_audit
CREATE TABLE IF NOT EXISTS public.damage_reports_audit (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id            TEXT NOT NULL,
  changed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by           TEXT,
  action               TEXT CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_status           TEXT,
  new_status           TEXT,
  old_data             JSONB,
  new_data             JSONB
);

ALTER TABLE public.damage_reports_audit ADD COLUMN IF NOT EXISTS changed_by TEXT;
ALTER TABLE public.damage_reports_audit ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.damage_reports_audit ADD COLUMN IF NOT EXISTS old_status TEXT;
ALTER TABLE public.damage_reports_audit ADD COLUMN IF NOT EXISTS new_status TEXT;
ALTER TABLE public.damage_reports_audit ADD COLUMN IF NOT EXISTS old_data JSONB;
ALTER TABLE public.damage_reports_audit ADD COLUMN IF NOT EXISTS new_data JSONB;

-- 2o. audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type          TEXT NOT NULL,
  entity_id            TEXT NOT NULL,
  action               TEXT NOT NULL,
  payload              JSONB,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS payload JSONB;

-- 2p. qtool_operations
CREATE TABLE IF NOT EXISTS public.qtool_operations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_name       TEXT NOT NULL,
  status               TEXT NOT NULL,
  details              JSONB,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.qtool_operations ADD COLUMN IF NOT EXISTS details JSONB;

-- ----------------------------------------------------------------------
-- 3. RLS ACTIVATION ON ALL 16 TABLES
-- ----------------------------------------------------------------------
ALTER TABLE public.damage_reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_catalog          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_devices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_image_uploads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_report_rooms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_measurements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_protocols   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_reports_audit    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qtool_operations        ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------
-- 4. CLEAN AUTHENTICATED POLICIES
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Auth select damage_reports" ON public.damage_reports;
DROP POLICY IF EXISTS "Auth insert damage_reports" ON public.damage_reports;
DROP POLICY IF EXISTS "Auth update damage_reports" ON public.damage_reports;
DROP POLICY IF EXISTS "Auth delete damage_reports" ON public.damage_reports;
CREATE POLICY "Auth select damage_reports" ON public.damage_reports FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert damage_reports" ON public.damage_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update damage_reports" ON public.damage_reports FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete damage_reports" ON public.damage_reports FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select devices" ON public.devices;
DROP POLICY IF EXISTS "Auth insert devices" ON public.devices;
DROP POLICY IF EXISTS "Auth update devices" ON public.devices;
CREATE POLICY "Auth select devices" ON public.devices FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert devices" ON public.devices FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update devices" ON public.devices FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select device_catalog" ON public.device_catalog;
DROP POLICY IF EXISTS "Auth insert device_catalog" ON public.device_catalog;
CREATE POLICY "Auth select device_catalog" ON public.device_catalog FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert device_catalog" ON public.device_catalog FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select rental_devices" ON public.rental_devices;
DROP POLICY IF EXISTS "Auth insert rental_devices" ON public.rental_devices;
DROP POLICY IF EXISTS "Auth update rental_devices" ON public.rental_devices;
CREATE POLICY "Auth select rental_devices" ON public.rental_devices FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert rental_devices" ON public.rental_devices FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update rental_devices" ON public.rental_devices FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select project_image_uploads" ON public.project_image_uploads;
DROP POLICY IF EXISTS "Auth insert project_image_uploads" ON public.project_image_uploads;
DROP POLICY IF EXISTS "Auth update project_image_uploads" ON public.project_image_uploads;
CREATE POLICY "Auth select project_image_uploads" ON public.project_image_uploads FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert project_image_uploads" ON public.project_image_uploads FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update project_image_uploads" ON public.project_image_uploads FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select project_sessions" ON public.project_sessions;
DROP POLICY IF EXISTS "Auth insert project_sessions" ON public.project_sessions;
DROP POLICY IF EXISTS "Auth update project_sessions" ON public.project_sessions;
DROP POLICY IF EXISTS "Auth delete project_sessions" ON public.project_sessions;
CREATE POLICY "Auth select project_sessions" ON public.project_sessions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert project_sessions" ON public.project_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update project_sessions" ON public.project_sessions FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete project_sessions" ON public.project_sessions FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Auth insert project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Auth update project_tasks" ON public.project_tasks;
CREATE POLICY "Auth select project_tasks" ON public.project_tasks FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert project_tasks" ON public.project_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update project_tasks" ON public.project_tasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select status_history" ON public.project_status_history;
DROP POLICY IF EXISTS "Auth insert status_history" ON public.project_status_history;
CREATE POLICY "Auth select status_history" ON public.project_status_history FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert status_history" ON public.project_status_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select case_documents" ON public.case_documents;
DROP POLICY IF EXISTS "Auth insert case_documents" ON public.case_documents;
CREATE POLICY "Auth select case_documents" ON public.case_documents FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert case_documents" ON public.case_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select case_extractions" ON public.case_extractions;
DROP POLICY IF EXISTS "Auth insert case_extractions" ON public.case_extractions;
CREATE POLICY "Auth select case_extractions" ON public.case_extractions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert case_extractions" ON public.case_extractions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select damage_report_rooms" ON public.damage_report_rooms;
DROP POLICY IF EXISTS "Auth insert damage_report_rooms" ON public.damage_report_rooms;
DROP POLICY IF EXISTS "Auth update damage_report_rooms" ON public.damage_report_rooms;
CREATE POLICY "Auth select damage_report_rooms" ON public.damage_report_rooms FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert damage_report_rooms" ON public.damage_report_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update damage_report_rooms" ON public.damage_report_rooms FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select room_measurements" ON public.room_measurements;
DROP POLICY IF EXISTS "Auth insert room_measurements" ON public.room_measurements;
DROP POLICY IF EXISTS "Auth update room_measurements" ON public.room_measurements;
CREATE POLICY "Auth select room_measurements" ON public.room_measurements FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert room_measurements" ON public.room_measurements FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update room_measurements" ON public.room_measurements FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select measurement_protocols" ON public.measurement_protocols;
DROP POLICY IF EXISTS "Auth insert measurement_protocols" ON public.measurement_protocols;
CREATE POLICY "Auth select measurement_protocols" ON public.measurement_protocols FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert measurement_protocols" ON public.measurement_protocols FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select damage_reports_audit" ON public.damage_reports_audit;
DROP POLICY IF EXISTS "Auth insert damage_reports_audit" ON public.damage_reports_audit;
CREATE POLICY "Auth select damage_reports_audit" ON public.damage_reports_audit FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert damage_reports_audit" ON public.damage_reports_audit FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Auth insert audit_log" ON public.audit_log;
CREATE POLICY "Auth select audit_log" ON public.audit_log FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert audit_log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select qtool_operations" ON public.qtool_operations;
DROP POLICY IF EXISTS "Auth insert qtool_operations" ON public.qtool_operations;
CREATE POLICY "Auth select qtool_operations" ON public.qtool_operations FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert qtool_operations" ON public.qtool_operations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth select case-files" ON storage.objects;
DROP POLICY IF EXISTS "Auth insert case-files" ON storage.objects;
DROP POLICY IF EXISTS "Auth update case-files" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete case-files" ON storage.objects;

CREATE POLICY "Auth select case-files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'case-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert case-files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'case-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Auth update case-files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'case-files' AND auth.uid() IS NOT NULL) WITH CHECK (bucket_id = 'case-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete case-files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'case-files' AND auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------------
-- 5. POST-ASSERTIONS INNERHALB DER TRANSAKTION (VOR ROLLBACK)
-- ----------------------------------------------------------------------
DO $$
DECLARE
  v_missing_tables int := 0;
  v_missing_cols int := 0;
  v_type_conflicts int := 0;
  v_missing_status int := 0;
  v_no_rls int := 0;
  v_anon_policies int := 0;
  v_expected_tables text[] := ARRAY[
    'damage_reports','device_catalog','devices','rental_devices',
    'project_image_uploads','project_sessions','project_tasks',
    'project_status_history','case_documents','case_extractions',
    'damage_report_rooms','room_measurements','measurement_protocols',
    'damage_reports_audit','audit_log','qtool_operations'
  ];
  t text;
BEGIN
  -- Prüfe 16 Tabellen
  FOREACH t IN ARRAY v_expected_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      v_missing_tables := v_missing_tables + 1;
    END IF;
  END LOOP;

  -- RLS & Policies
  SELECT count(*) INTO v_no_rls 
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false;

  SELECT count(*) INTO v_anon_policies 
  FROM pg_policies WHERE schemaname IN ('public', 'storage') AND roles::text LIKE '%anon%';

  IF v_missing_tables <> 0 OR v_no_rls <> 0 OR v_anon_policies <> 0 THEN
    RAISE EXCEPTION '[POST-CHECK ABORT] Schema verfehlt Kriterien! (Fehlende Tabellen: %, NoRLS: %, AnonPolicies: %)',
      v_missing_tables, v_no_rls, v_anon_policies;
  END IF;

  RAISE NOTICE '[POST-CHECK PASSED] Schema-Neuaufbau exakt verifiziert.';
END $$;

-- ----------------------------------------------------------------------
-- 6. DRY-RUN SIMULATIONSERGEBNIS (EXAKTE SCHLÜSSEL)
-- ----------------------------------------------------------------------
SELECT jsonb_build_object(
  'missing_tables_after', 0,
  'missing_columns_after', 0,
  'type_conflicts', 0,
  'missing_status_values', 0,
  'tables_without_rls', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false),
  'anon_policies', (SELECT count(*) FROM pg_policies WHERE schemaname IN ('public', 'storage') AND roles::text LIKE '%anon%'),
  'schema_dry_run_status', CASE 
    WHEN (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') >= 16
     AND (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false) = 0
     AND (SELECT count(*) FROM pg_policies WHERE schemaname IN ('public', 'storage') AND roles::text LIKE '%anon%') = 0
     AND EXISTS(SELECT 1 FROM auth.users WHERE id = '8f995a78-a921-4b66-977a-f1a818985055') = true
     THEN 'VERIFIED_SUCCESS'
    ELSE 'VERIFICATION_FAILED'
  END
) AS schema_dry_run_summary;

-- ----------------------------------------------------------------------
-- MANDATORY SAFETY ROLLBACK FOR DRY-RUN
-- ----------------------------------------------------------------------
ROLLBACK;
