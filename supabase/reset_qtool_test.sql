-- ======================================================================
-- BEREINIGUNGSSKRIPT DRY-RUN FÜR SUPABASE-TESTPROJEKT (QTool-Test)
-- 
-- ⚠️ VERBOTENES LIVE-PROJEKT: yxdoecdqttgdncgbzyus
-- ⚠️ PFLICHT-TEST-PROJEKT:   aoxduqspiezzyqeqyzzl
--
-- OPERATOR-HINWEIS:
-- Bitte vor dem Klick auf "Run" im Dashboard verifizieren:
-- 1. Browser-URL enthält "aoxduqspiezzyqeqyzzl"
-- 2. Browser-URL enthält NICHT "yxdoecdqttgdncgbzyus"
-- 3. Oben im SQL-Editor steht "QTool-Test"
-- 
-- SAFE DRY-RUN VERSION: ENDET MIT ROLLBACK
-- ======================================================================

BEGIN;

-- ----------------------------------------------------------------------
-- 1. PRE-ASSERTIONS: Exakte Bestands-, Audit-Gruppen- & Bucket-Prüfung
-- ----------------------------------------------------------------------
DO $$
DECLARE
  v_report_count int;
  v_audit_total int;
  v_audit_proj int;
  v_audit_anon int;
  v_audit_auto int;
  v_case_exists bool;
  v_dmg_exists bool;
  v_prj_exists bool;
  v_auth_user_exists bool;
  v_missing_policies_count int;
  v_extra_policies_count int;
  v_storage_objs int;
BEGIN
  -- 1a. Exakte Prüfung damage_reports (exakt 1)
  SELECT count(*) INTO v_report_count FROM public.damage_reports WHERE id = '0bf7027e-12d7-422b-a702-1059ac981f67';
  IF v_report_count <> 1 THEN
    RAISE EXCEPTION '[SAFETY ABORT] Erwartete damage_reports Zeilenzahl von 1 verfehlt! Erhalten: %', v_report_count;
  END IF;

  -- 1b. Exakte Audit-Gruppen-Prüfung (gesamt 31 vor der Löschung)
  SELECT count(*) INTO v_audit_total FROM public.damage_reports_audit;
  SELECT count(*) INTO v_audit_proj FROM public.damage_reports_audit WHERE report_id = '0bf7027e-12d7-422b-a702-1059ac981f67';
  SELECT count(*) INTO v_audit_anon FROM public.damage_reports_audit WHERE report_id = 'ANON-TEST-INSERT-ID';
  SELECT count(*) INTO v_audit_auto FROM public.damage_reports_audit WHERE report_id = 'TEST-AUTO-2026-06-18';

  IF v_audit_total <> 31 OR v_audit_proj <> 27 OR v_audit_anon <> 2 OR v_audit_auto <> 2 THEN
    RAISE EXCEPTION '[SAFETY ABORT] Audit-Zeilenzahlen abweichend! Total: % (erwartet 31), Proj: % (erwartet 27), Anon: % (erwartet 2), Auto: % (erwartet 2)',
      v_audit_total, v_audit_proj, v_audit_anon, v_audit_auto;
  END IF;

  -- 1c. Bucket-Existenz & Storage-Objekt-Count prüfen
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'case-files') INTO v_case_exists;
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'damage-images') INTO v_dmg_exists;
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'project-images') INTO v_prj_exists;
  SELECT count(*) INTO v_storage_objs FROM storage.objects;

  IF NOT v_case_exists OR NOT v_dmg_exists OR NOT v_prj_exists OR v_storage_objs <> 0 THEN
    RAISE EXCEPTION '[SAFETY ABORT] Buckets oder Storage-Objekte abweichend! (case: %, dmg: %, prj: %, objs: %)',
      v_case_exists, v_dmg_exists, v_prj_exists, v_storage_objs;
  END IF;

  -- 1d. Auth-Benutzer prüfen
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = '8f995a78-a921-4b66-977a-f1a818985055') INTO v_auth_user_exists;
  IF NOT v_auth_user_exists THEN
    RAISE EXCEPTION '[SAFETY ABORT] Erwarteter Auth-Benutzer 8f995a78... fehlt!';
  END IF;

  -- 1e. Bidirektionaler Policy-Vergleich via CTE VALUES
  WITH expected(schemaname, tablename, policyname) AS (
    VALUES
      ('public', 'case_documents', 'Enable all access for anon'),
      ('public', 'case_extractions', 'Enable all access for anon'),
      ('public', 'damage_reports_audit', 'Audit lesbar für alle'),
      ('public', 'damage_reports_audit', 'Audit nur über Trigger'),
      ('public', 'damage_report_rooms', 'qtool_andreas_all_damage_report_rooms'),
      ('public', 'damage_reports', 'qtool_andreas_delete_damage_reports'),
      ('public', 'damage_reports', 'qtool_andreas_insert_damage_reports'),
      ('public', 'damage_reports', 'qtool_andreas_update_damage_reports'),
      ('public', 'damage_reports', 'qtool_test_andreas_select_damage_reports'),
      ('public', 'device_catalog', 'qtool_andreas_all_device_catalog'),
      ('public', 'devices', 'qtool_andreas_all_devices'),
      ('public', 'measurement_protocols', 'qtool_andreas_all_measurement_protocols'),
      ('public', 'project_image_uploads', 'qtool_andreas_all_project_image_uploads'),
      ('public', 'qtool_operations', 'qtool_andreas_all_qtool_operations'),
      ('public', 'room_measurements', 'qtool_andreas_all_room_measurements'),
      ('storage', 'objects', 'Allow Uploads for Anon'),
      ('storage', 'objects', 'Allow Uploads for Anon to Case Files'),
      ('storage', 'objects', 'Anon read own from project-images'),
      ('storage', 'objects', 'Anon upload to project-images'),
      ('storage', 'objects', 'Public Access to Case Files'),
      ('storage', 'objects', 'Public Access to Images')
  ),
  actual AS (
    SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname IN ('public', 'storage')
  )
  SELECT
    (SELECT count(*) FROM (SELECT * FROM expected EXCEPT SELECT * FROM actual) sub1),
    (SELECT count(*) FROM (SELECT * FROM actual EXCEPT SELECT * FROM expected) sub2)
  INTO v_missing_policies_count, v_extra_policies_count;

  IF v_missing_policies_count <> 0 OR v_extra_policies_count <> 0 THEN
    RAISE EXCEPTION '[SAFETY ABORT] Policy-Abweichung erkannt! Fehlend: %, Unerwartet: %', v_missing_policies_count, v_extra_policies_count;
  END IF;

  RAISE NOTICE '[PRE-CHECK PASSED] Pre-Assertions exakt verifiziert.';
END $$;

-- ----------------------------------------------------------------------
-- 2. Eingegrenzte Datenbereinigung (REPORTS ZUERST, AUDITS DANACH)
-- ----------------------------------------------------------------------
DO $$
DECLARE
  v_deleted_report_rows int;
  v_deleted_audit_rows int;
BEGIN
  -- 2a. ZUERST den Report löschen (erzeugt 1 Trigger-Audit-Zeile)
  DELETE FROM public.damage_reports WHERE id = '0bf7027e-12d7-422b-a702-1059ac981f67';
  GET DIAGNOSTICS v_deleted_report_rows = ROW_COUNT;
  IF v_deleted_report_rows <> 1 THEN
    RAISE EXCEPTION '[SAFETY ABORT] Gelöschte Report-Zeilenzahl ungleich 1! Erhalten: %', v_deleted_report_rows;
  END IF;

  -- 2b. DANACH alle Audit-Zeilen löschen (31 Alt-Audits + 1 Trigger-Audit = 32)
  DELETE FROM public.damage_reports_audit
  WHERE report_id IN (
    '0bf7027e-12d7-422b-a702-1059ac981f67',
    'ANON-TEST-INSERT-ID',
    'TEST-AUTO-2026-06-18'
  );
  GET DIAGNOSTICS v_deleted_audit_rows = ROW_COUNT;
  IF v_deleted_audit_rows <> 32 THEN
    RAISE EXCEPTION '[SAFETY ABORT] Gelöschte Audit-Zeilenzahl ungleich 32 (31 Alt + 1 Trigger)! Erhalten: %', v_deleted_audit_rows;
  END IF;
END $$;

-- ----------------------------------------------------------------------
-- 3. Entfernen der exakt 21 Verbatim Policies
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all access for anon" ON public.case_documents;
DROP POLICY IF EXISTS "Enable all access for anon" ON public.case_extractions;
DROP POLICY IF EXISTS "Audit lesbar für alle" ON public.damage_reports_audit;
DROP POLICY IF EXISTS "Audit nur über Trigger" ON public.damage_reports_audit;

DROP POLICY IF EXISTS "qtool_andreas_all_damage_report_rooms" ON public.damage_report_rooms;
DROP POLICY IF EXISTS "qtool_andreas_delete_damage_reports" ON public.damage_reports;
DROP POLICY IF EXISTS "qtool_andreas_insert_damage_reports" ON public.damage_reports;
DROP POLICY IF EXISTS "qtool_andreas_update_damage_reports" ON public.damage_reports;
DROP POLICY IF EXISTS "qtool_test_andreas_select_damage_reports" ON public.damage_reports;
DROP POLICY IF EXISTS "qtool_andreas_all_device_catalog" ON public.device_catalog;
DROP POLICY IF EXISTS "qtool_andreas_all_devices" ON public.devices;
DROP POLICY IF EXISTS "qtool_andreas_all_measurement_protocols" ON public.measurement_protocols;
DROP POLICY IF EXISTS "qtool_andreas_all_project_image_uploads" ON public.project_image_uploads;
DROP POLICY IF EXISTS "qtool_andreas_all_qtool_operations" ON public.qtool_operations;
DROP POLICY IF EXISTS "qtool_andreas_all_room_measurements" ON public.room_measurements;

DROP POLICY IF EXISTS "Allow Uploads for Anon" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads for Anon to Case Files" ON storage.objects;
DROP POLICY IF EXISTS "Anon read own from project-images" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload to project-images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Case Files" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Images" ON storage.objects;

-- ----------------------------------------------------------------------
-- 4. RLS Aktivierung auf allen Fachtabellen
-- ----------------------------------------------------------------------
ALTER TABLE IF EXISTS public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.damage_report_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.damage_reports_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.device_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.measurement_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_image_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.qtool_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rental_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.room_measurements ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------
-- 5. PRE-COMMIT POST-CHECK (OHNE WRITE AUF STORAGE.BUCKETS)
-- ----------------------------------------------------------------------
DO $$
DECLARE
  v_total_reports int;
  v_total_audits int;
  v_proj_audit int;
  v_anon_audit int;
  v_auto_audit int;
  v_policies_rem int;
  v_policies_uuid int;
  v_case_exists bool;
  v_dmg_exists bool;
  v_prj_exists bool;
  v_auth_user_exists bool;
  v_no_rls_count int;
  v_storage_objs int;
BEGIN
  SELECT count(*) INTO v_total_reports FROM public.damage_reports;
  SELECT count(*) INTO v_total_audits FROM public.damage_reports_audit;
  SELECT count(*) INTO v_proj_audit FROM public.damage_reports_audit WHERE report_id = '0bf7027e-12d7-422b-a702-1059ac981f67';
  SELECT count(*) INTO v_anon_audit FROM public.damage_reports_audit WHERE report_id = 'ANON-TEST-INSERT-ID';
  SELECT count(*) INTO v_auto_audit FROM public.damage_reports_audit WHERE report_id = 'TEST-AUTO-2026-06-18';
  SELECT count(*) INTO v_policies_rem FROM pg_policies WHERE schemaname IN ('public', 'storage');
  SELECT count(*) INTO v_policies_uuid FROM pg_policies WHERE schemaname IN ('public', 'storage') AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%8f995a78-a921-4b66-977a-f1a818985055%';

  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'case-files') INTO v_case_exists;
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'damage-images') INTO v_dmg_exists;
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'project-images') INTO v_prj_exists;
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = '8f995a78-a921-4b66-977a-f1a818985055') INTO v_auth_user_exists;
  SELECT count(*) INTO v_storage_objs FROM storage.objects;

  SELECT count(*) INTO v_no_rls_count 
  FROM pg_class c 
  JOIN pg_namespace n ON n.oid = c.relnamespace 
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false;

  IF v_total_reports <> 0 OR v_total_audits <> 0 OR v_proj_audit <> 0 OR v_anon_audit <> 0 OR v_auto_audit <> 0 
     OR v_policies_rem <> 0 OR v_policies_uuid <> 0
     OR (v_case_exists IS DISTINCT FROM true)
     OR (v_dmg_exists IS DISTINCT FROM true) 
     OR (v_prj_exists IS DISTINCT FROM true) 
     OR (v_auth_user_exists IS DISTINCT FROM true) 
     OR v_no_rls_count <> 0 
     OR v_storage_objs <> 0 THEN
    RAISE EXCEPTION '[PRE-COMMIT ASSERTION ABORT] Transaktions-Zustand fehlerhaft! (Reports: %, Audits: %, Policies: %, CaseExt: %, DmgExt: %, PrjExt: %, UserExt: %, NoRLS: %, StorageObjs: %)',
      v_total_reports, v_total_audits, v_policies_rem, v_case_exists, v_dmg_exists, v_prj_exists, v_auth_user_exists, v_no_rls_count, v_storage_objs;
  END IF;

  RAISE NOTICE '[PRE-COMMIT CHECK PASSED] Alle Datenbank-Bedingungen vor ROLLBACK exakt verifiziert.';
END $$;

-- ----------------------------------------------------------------------
-- 6. DYNAMISCHES DRY-RUN SIMULATIONSERGEBNIS (REIN LESEND)
-- ----------------------------------------------------------------------
SELECT jsonb_build_object(
  'damage_reports_remaining', (SELECT count(*) FROM public.damage_reports),
  'damage_reports_audit_remaining', (SELECT count(*) FROM public.damage_reports_audit),
  'policies_remaining_total', (SELECT count(*) FROM pg_policies WHERE schemaname IN ('public', 'storage')),
  'policies_containing_old_uuid', (SELECT count(*) FROM pg_policies WHERE schemaname IN ('public', 'storage') AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%8f995a78-a921-4b66-977a-f1a818985055%'),
  'public_tables_without_rls', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false),
  'auth_user_still_exists', EXISTS(SELECT 1 FROM auth.users WHERE id = '8f995a78-a921-4b66-977a-f1a818985055'),
  'storage_objects_count', (SELECT count(*) FROM storage.objects),
  'case_files_bucket_exists', EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'case-files'),
  'damage_images_bucket_exists', EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'damage-images'),
  'project_images_bucket_exists', EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'project-images'),
  'database_cleanup_status', 'PASSED',
  'bucket_cleanup_status', 'MANUAL_ACTION_REQUIRED'
) AS dry_run_summary;

-- ----------------------------------------------------------------------
-- MANDATORY SAFETY ROLLBACK FOR DRY-RUN
-- ----------------------------------------------------------------------
ROLLBACK;
