-- Migration to enforce atomic active project lock on database level
-- Guarantees that at most one session is active/locked for a project at any time.

CREATE UNIQUE INDEX IF NOT EXISTS project_sessions_unique_active_project 
  ON public.project_sessions (open_project_id) 
  WHERE (open_project_id IS NOT NULL);

-- Function to atomically acquire project lock and handle expired takeovers
CREATE OR REPLACE FUNCTION public.acquire_project_lock(
  p_project_id TEXT,
  p_session_token TEXT,
  p_user_id TEXT,
  p_user_name TEXT,
  p_device TEXT
)
RETURNS TABLE (
  acquired BOOLEAN,
  lock_owner TEXT,
  locked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ
) AS $$
DECLARE
  v_existing_token TEXT;
  v_existing_last_seen TIMESTAMPTZ;
  v_existing_created_at TIMESTAMPTZ;
  v_existing_device TEXT;
  v_is_expired BOOLEAN;
BEGIN
  -- 1. Find existing active session for this project
  SELECT session_token, last_seen, created_at, device
  INTO v_existing_token, v_existing_last_seen, v_existing_created_at, v_existing_device
  FROM public.project_sessions
  WHERE open_project_id = p_project_id;

  IF FOUND THEN
    -- Check expiration (20 minutes inactivity timeout)
    v_is_expired := v_existing_last_seen < NOW() - INTERVAL '20 minutes';

    IF v_is_expired OR v_existing_token = p_session_token THEN
      -- If expired, release the old lock from the other session (set open_project_id to NULL)
      IF v_existing_token != p_session_token THEN
        UPDATE public.project_sessions
        SET open_project_id = NULL
        WHERE session_token = v_existing_token;
      END IF;

      -- Acquire lock for new session (or update existing)
      INSERT INTO public.project_sessions (session_token, open_project_id, device, last_seen)
      VALUES (p_session_token, p_project_id, p_device, NOW())
      ON CONFLICT (session_token)
      DO UPDATE SET
        open_project_id = EXCLUDED.open_project_id,
        device = EXCLUDED.device,
        last_seen = EXCLUDED.last_seen;

      RETURN QUERY SELECT TRUE, p_user_name, NOW(), NOW();
    ELSE
      -- Valid lock exists, cannot acquire.
      -- Register/update our own session as a passive observer session (open_project_id = NULL)
      INSERT INTO public.project_sessions (session_token, open_project_id, device, last_seen)
      VALUES (p_session_token, NULL, p_device, NOW())
      ON CONFLICT (session_token)
      DO UPDATE SET
        open_project_id = NULL,
        device = EXCLUDED.device,
        last_seen = EXCLUDED.last_seen;

      RETURN QUERY SELECT FALSE, COALESCE(NULLIF(SPLIT_PART(v_existing_device, ':', 3), ''), 'Unbekannt'), v_existing_created_at, v_existing_last_seen;
    END IF;
  ELSE
    -- No lock exists, acquire it!
    INSERT INTO public.project_sessions (session_token, open_project_id, device, last_seen)
    VALUES (p_session_token, p_project_id, p_device, NOW())
    ON CONFLICT (session_token)
    DO UPDATE SET
      open_project_id = EXCLUDED.open_project_id,
      device = EXCLUDED.device,
      last_seen = EXCLUDED.last_seen;

    RETURN QUERY SELECT TRUE, p_user_name, NOW(), NOW();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
