-- ======================================================================
-- REIN LESENDE SYNTAX-PRÜFUNG FÜR DIE POST-COMMIT-ABFRAGE
-- Projekt: QTool-Test (aoxduqspiezzyqeqyzzl)
-- Ausführung vor dem Reset: Prüft Spaltennamen & Syntax
-- Erwartetes Status-Ergebnis vor dem Reset: "VERIFICATION_FAILED" (vollkommen normal)
-- ======================================================================

SELECT jsonb_build_object(
  'damage_reports_remaining', (SELECT count(*) FROM public.damage_reports),
  'damage_reports_audit_remaining', (SELECT count(*) FROM public.damage_reports_audit),
  'policies_remaining_total', (SELECT count(*) FROM pg_policies WHERE schemaname IN ('public', 'storage')),
  'policies_containing_old_uuid', (SELECT count(*) FROM pg_policies WHERE schemaname IN ('public', 'storage') AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%8f995a78-a921-4b66-977a-f1a818985055%'),
  'public_tables_without_rls', (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false),
  'auth_user_still_exists', EXISTS(SELECT 1 FROM auth.users WHERE id = '8f995a78-a921-4b66-977a-f1a818985055'),
  'case_files_bucket_count', (SELECT count(*) FROM storage.buckets WHERE id = 'case-files'),
  'case_files_bucket_public', (SELECT public FROM storage.buckets WHERE id = 'case-files'),
  'case_files_file_size_limit', (SELECT file_size_limit FROM storage.buckets WHERE id = 'case-files'),
  'case_files_allowed_mime_types', (SELECT allowed_mime_types FROM storage.buckets WHERE id = 'case-files'),
  'damage_images_bucket_exists', EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'damage-images'),
  'project_images_bucket_exists', EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'project-images'),
  'storage_objects_count', (SELECT count(*) FROM storage.objects),
  'post_reset_status', CASE 
    WHEN (SELECT count(*) FROM public.damage_reports) = 0
     AND (SELECT count(*) FROM public.damage_reports_audit) = 0
     AND (SELECT count(*) FROM pg_policies WHERE schemaname IN ('public', 'storage')) = 0
     AND (SELECT count(*) FROM pg_policies WHERE schemaname IN ('public', 'storage') AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%8f995a78-a921-4b66-977a-f1a818985055%') = 0
     AND (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false) = 0
     AND EXISTS(SELECT 1 FROM auth.users WHERE id = '8f995a78-a921-4b66-977a-f1a818985055') = true
     AND (SELECT count(*) FROM storage.buckets WHERE id = 'case-files') = 1
     AND (SELECT public FROM storage.buckets WHERE id = 'case-files') IS NOT DISTINCT FROM false
     AND (SELECT file_size_limit FROM storage.buckets WHERE id = 'case-files') IS NOT DISTINCT FROM 52428800::bigint
     AND (SELECT allowed_mime_types FROM storage.buckets WHERE id = 'case-files') IS NOT DISTINCT FROM ARRAY['image/jpeg','image/png','image/heic','image/webp','application/pdf']::text[]
     AND EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'damage-images') = false
     AND EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'project-images') = false
     AND (SELECT count(*) FROM storage.objects) = 0
     THEN 'VERIFIED_SUCCESS'
    ELSE 'VERIFICATION_FAILED'
  END
) AS post_commit_syntax_check;
