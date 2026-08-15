-- QTool-Test: one authoritative writer lease per project.
-- Apply to the TEST database only after review. This file performs no action
-- merely by existing in the repository.

BEGIN;

-- Repair legacy duplicate owners before enforcing the invariant. Keep exactly
-- one deterministic winner per project: iPad first, then freshest activity,
-- newest creation time, finally lexical token as a stable tie-breaker.
WITH ranked_owners AS (
  SELECT session_token,
         row_number() OVER (
           PARTITION BY open_project_id
           ORDER BY
             (split_part(coalesce(device, ''), ':', 1) = 'iPad') DESC,
             last_seen DESC NULLS LAST,
             created_at DESC NULLS LAST,
             session_token ASC
         ) AS owner_rank
  FROM public.project_sessions
  WHERE open_project_id IS NOT NULL
), losing_owners AS (
  SELECT session_token
  FROM ranked_owners
  WHERE owner_rank > 1
)
UPDATE public.project_sessions AS sessions
SET open_project_id = NULL
FROM losing_owners
WHERE sessions.session_token = losing_owners.session_token;

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
  v_owner public.project_sessions%ROWTYPE;
  v_request_is_ipad BOOLEAN := split_part(coalesce(p_device, ''), ':', 1) = 'iPad';
  v_owner_is_ipad BOOLEAN;
BEGIN
  -- Serialise contenders for this project before inspecting/changing its row.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_project_id, 0));

  SELECT * INTO v_owner
  FROM public.project_sessions
  WHERE open_project_id = p_project_id
  LIMIT 1;

  IF FOUND THEN
    v_owner_is_ipad := split_part(coalesce(v_owner.device, ''), ':', 1) = 'iPad';

    IF v_owner.session_token = p_session_token THEN
      UPDATE public.project_sessions
      SET device = p_device, mode = CASE WHEN v_request_is_ipad THEN 'technician' ELSE 'desktop' END,
          last_seen = now()
      WHERE session_token = p_session_token AND open_project_id = p_project_id;
      RETURN QUERY SELECT true, p_user_name, v_owner.created_at, now();
      RETURN;
    END IF;

    -- A stale lease can be recovered by either device. A live iPad may
    -- atomically replace a desktop owner, but never another live iPad owner.
    IF v_owner.last_seen < now() - interval '20 minutes'
       OR (v_request_is_ipad AND NOT v_owner_is_ipad) THEN
      UPDATE public.project_sessions
      SET open_project_id = NULL
      WHERE session_token = v_owner.session_token
        AND open_project_id = p_project_id;
    ELSE
      INSERT INTO public.project_sessions (session_token, open_project_id, mode, device, last_seen)
      VALUES (p_session_token, NULL,
              CASE WHEN v_request_is_ipad THEN 'technician' ELSE 'desktop' END,
              p_device, now())
      ON CONFLICT (session_token) DO UPDATE
        SET open_project_id = NULL, mode = excluded.mode,
            device = excluded.device, last_seen = excluded.last_seen;
      RETURN QUERY SELECT false,
        coalesce(nullif(split_part(v_owner.device, ':', 3), ''), 'Unbekannt'),
        v_owner.created_at, v_owner.last_seen;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.project_sessions
    (session_token, open_project_id, mode, device, last_seen, created_at)
  VALUES
    (p_session_token, p_project_id,
     CASE WHEN v_request_is_ipad THEN 'technician' ELSE 'desktop' END,
     p_device, now(), now())
  ON CONFLICT (session_token) DO UPDATE
    SET open_project_id = excluded.open_project_id, mode = excluded.mode,
        device = excluded.device, last_seen = excluded.last_seen,
        created_at = CASE
          WHEN project_sessions.open_project_id IS DISTINCT FROM excluded.open_project_id THEN now()
          ELSE project_sessions.created_at
        END;

  RETURN QUERY SELECT true, p_user_name, now(), now();
END;
$$;

CREATE OR REPLACE FUNCTION public.release_project_lock(
  p_project_id TEXT,
  p_session_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_released_count INTEGER;
BEGIN
  UPDATE public.project_sessions
  SET open_project_id = NULL, last_seen = now()
  WHERE open_project_id = p_project_id
    AND session_token = p_session_token;
  GET DIAGNOSTICS v_released_count = ROW_COUNT;
  RETURN v_released_count = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_project_lock(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_project_lock(TEXT, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
