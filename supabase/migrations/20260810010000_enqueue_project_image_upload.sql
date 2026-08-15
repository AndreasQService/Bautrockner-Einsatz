-- Narrow journal enqueue contract for clients without a Supabase Auth session.
-- The function can only reference an existing project and an existing object
-- in the case-files bucket. It never grants direct table write access.

CREATE OR REPLACE FUNCTION public.enqueue_project_image_upload(
  p_project_id TEXT,
  p_local_image_id TEXT,
  p_filename TEXT,
  p_mime_type TEXT,
  p_size_bytes BIGINT,
  p_sha256 TEXT,
  p_storage_bucket TEXT,
  p_storage_path TEXT,
  p_remote_path TEXT
)
RETURNS TABLE(storage_status TEXT, remote_item_id TEXT, remote_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
BEGIN
  IF p_project_id IS NULL OR length(p_project_id) NOT BETWEEN 1 AND 100
     OR p_local_image_id IS NULL OR length(p_local_image_id) NOT BETWEEN 3 AND 150
     OR p_filename IS NULL OR length(p_filename) NOT BETWEEN 1 AND 255
     OR p_filename ~ '[\\/\x00-\x1f]'
     OR p_storage_bucket <> 'case-files'
     OR p_storage_path IS NULL OR length(p_storage_path) > 500
     OR p_remote_path IS NULL OR length(p_remote_path) > 400
     OR p_remote_path !~ '^QTool/[^/]+/(Fotos|Dokumente|Messprotokolle)/[^/]+/.+$'
     OR p_remote_path ~ '(^|/)\.\.(/|$)|[\\\x00-\x1f]'
     OR COALESCE(p_size_bytes, 0) < 0 OR COALESCE(p_size_bytes, 0) > 104857600 THEN
    RAISE EXCEPTION 'Invalid upload journal payload' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.damage_reports WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'Unknown project' USING ERRCODE = '23503';
  END IF;

  IF NOT (
    strpos(p_storage_path, 'cases/' || p_project_id || '/images/') = 1
    OR (p_storage_path LIKE 'TESTRUN_%' AND strpos(p_storage_path, '/' || p_project_id || '/Fotos/') > 0)
  ) THEN
    RAISE EXCEPTION 'Storage path does not belong to project' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = p_storage_bucket AND name = p_storage_path
  ) THEN
    RAISE EXCEPTION 'Storage object does not exist' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.project_image_uploads (
    project_id, local_image_id, filename, mime_type, size_bytes, sha256,
    storage_bucket, storage_path, storage_status, remote_path, updated_at
  ) VALUES (
    p_project_id, p_local_image_id, p_filename, COALESCE(NULLIF(p_mime_type, ''), 'image/jpeg'),
    p_size_bytes, p_sha256, p_storage_bucket, p_storage_path,
    'uploaded_to_backend', p_remote_path, NOW()
  )
  ON CONFLICT (local_image_id) DO UPDATE SET
    filename = EXCLUDED.filename,
    mime_type = EXCLUDED.mime_type,
    size_bytes = EXCLUDED.size_bytes,
    sha256 = EXCLUDED.sha256,
    storage_bucket = EXCLUDED.storage_bucket,
    storage_path = EXCLUDED.storage_path,
    remote_path = CASE
      WHEN project_image_uploads.sha256 IS DISTINCT FROM EXCLUDED.sha256
        OR project_image_uploads.size_bytes IS DISTINCT FROM EXCLUDED.size_bytes
        OR project_image_uploads.storage_path IS DISTINCT FROM EXCLUDED.storage_path
        OR project_image_uploads.remote_path IS DISTINCT FROM EXCLUDED.remote_path
      THEN EXCLUDED.remote_path
      WHEN project_image_uploads.remote_item_id IS NULL THEN EXCLUDED.remote_path
      ELSE project_image_uploads.remote_path
    END,
    storage_status = CASE
      WHEN project_image_uploads.sha256 IS DISTINCT FROM EXCLUDED.sha256
        OR project_image_uploads.size_bytes IS DISTINCT FROM EXCLUDED.size_bytes
        OR project_image_uploads.storage_path IS DISTINCT FROM EXCLUDED.storage_path
        OR project_image_uploads.remote_path IS DISTINCT FROM EXCLUDED.remote_path
        OR project_image_uploads.remote_item_id IS NULL THEN 'uploaded_to_backend'
      ELSE project_image_uploads.storage_status
    END,
    retry_count = CASE
      WHEN project_image_uploads.sha256 IS DISTINCT FROM EXCLUDED.sha256
        OR project_image_uploads.size_bytes IS DISTINCT FROM EXCLUDED.size_bytes
        OR project_image_uploads.storage_path IS DISTINCT FROM EXCLUDED.storage_path
        OR project_image_uploads.remote_path IS DISTINCT FROM EXCLUDED.remote_path
        OR project_image_uploads.remote_item_id IS NULL THEN 0 ELSE project_image_uploads.retry_count END,
    last_error = CASE
      WHEN project_image_uploads.sha256 IS DISTINCT FROM EXCLUDED.sha256
        OR project_image_uploads.size_bytes IS DISTINCT FROM EXCLUDED.size_bytes
        OR project_image_uploads.storage_path IS DISTINCT FROM EXCLUDED.storage_path
        OR project_image_uploads.remote_path IS DISTINCT FROM EXCLUDED.remote_path
        OR project_image_uploads.remote_item_id IS NULL THEN NULL ELSE project_image_uploads.last_error END,
    updated_at = NOW();

  RETURN QUERY
  SELECT p.storage_status, p.remote_item_id, p.remote_path
  FROM public.project_image_uploads p
  WHERE p.local_image_id = p_local_image_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_project_image_upload(TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_project_image_upload(TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT,TEXT,TEXT,TEXT)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
