-- Repair the production contract used by current and previous QTool clients.
-- This migration is idempotent and must be applied before the fixed frontend
-- can complete upload-journal verification and atomic project locking.

-- The deployed client still sends p_client_id while the current client does
-- not. A trailing default parameter supports both PostgREST payloads.
CREATE UNIQUE INDEX IF NOT EXISTS project_sessions_unique_active_project
  ON public.project_sessions (open_project_id)
  WHERE open_project_id IS NOT NULL;

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
RETURNS TABLE (
  acquired BOOLEAN,
  lock_owner TEXT,
  locked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_existing_token TEXT;
  v_existing_last_seen TIMESTAMPTZ;
  v_existing_created_at TIMESTAMPTZ;
  v_existing_device TEXT;
BEGIN
  SELECT session_token, last_seen, created_at, device
    INTO v_existing_token, v_existing_last_seen, v_existing_created_at, v_existing_device
  FROM public.project_sessions
  WHERE open_project_id = p_project_id
  LIMIT 1;

  IF FOUND AND v_existing_token <> p_session_token
     AND v_existing_last_seen >= NOW() - INTERVAL '20 minutes' THEN
    INSERT INTO public.project_sessions (session_token, open_project_id, device, last_seen)
    VALUES (p_session_token, NULL, p_device, NOW())
    ON CONFLICT (session_token) DO UPDATE
      SET open_project_id = NULL, device = EXCLUDED.device, last_seen = EXCLUDED.last_seen;

    RETURN QUERY SELECT
      FALSE,
      COALESCE(NULLIF(SPLIT_PART(v_existing_device, ':', 3), ''), 'Unbekannt'),
      v_existing_created_at,
      v_existing_last_seen;
    RETURN;
  END IF;

  IF FOUND AND v_existing_token <> p_session_token THEN
    UPDATE public.project_sessions
    SET open_project_id = NULL
    WHERE session_token = v_existing_token;
  END IF;

  INSERT INTO public.project_sessions (session_token, open_project_id, device, last_seen)
  VALUES (p_session_token, p_project_id, p_device, NOW())
  ON CONFLICT (session_token) DO UPDATE
    SET open_project_id = EXCLUDED.open_project_id,
        device = EXCLUDED.device,
        last_seen = EXCLUDED.last_seen;

  RETURN QUERY SELECT TRUE, p_user_name, NOW(), NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_project_lock(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
