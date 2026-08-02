-- =====================================================================
-- QTool – RPC: sync_measurement_followup
-- Dateipfad: supabase/sync_measurement_followup.sql
-- =====================================================================

CREATE OR REPLACE FUNCTION public.sync_measurement_followup(
    p_project_id TEXT,
    p_measurement_date DATE,
    p_drying_completed BOOLEAN,
    p_user_name TEXT
) RETURNS TABLE (
    action TEXT,
    todo_id UUID,
    due_date DATE,
    closed_todo_ids UUID[],
    created BOOLEAN
) AS $$
DECLARE
    v_deterministic_id UUID;
    v_requested_due_date DATE;
    v_closed_todo_ids UUID[];
    v_latest_open_id UUID;
    v_latest_open_due_date DATE;
    v_col_project_id TEXT;
    v_col_created_by TEXT;
BEGIN
    -- 1. Parameter validieren (Exception vor jeglichen Schreiboperationen)
    IF p_project_id IS NULL OR char_length(trim(p_project_id)) = 0 THEN
        RAISE EXCEPTION 'Projekt-ID (p_project_id) darf nicht leer sein.';
    END IF;
    IF p_measurement_date IS NULL THEN
        RAISE EXCEPTION 'Messungsdatum (p_measurement_date) darf nicht NULL sein.';
    END IF;
    IF p_drying_completed IS NULL THEN
        RAISE EXCEPTION 'Trocknungs-Status (p_drying_completed) darf nicht NULL sein.';
    END IF;
    IF p_user_name IS NULL OR char_length(trim(p_user_name)) = 0 THEN
        RAISE EXCEPTION 'Benutzername (p_user_name) darf nicht leer sein.';
    END IF;

    -- 2. Advisory Lock pro Projekt-ID (Race-Condition-Schutz)
    PERFORM pg_advisory_xact_lock(hashtext(p_project_id));

    -- 3. Projekt-Existenzprüfung
    IF NOT EXISTS (SELECT 1 FROM public.damage_reports WHERE id = p_project_id) THEN
        RAISE EXCEPTION 'Projekt % existiert nicht.', p_project_id;
    END IF;

    -- 4. UUID und due_date berechnen
    v_deterministic_id := CAST(md5(p_project_id || ':measurement_followup:' || to_char(p_measurement_date, 'YYYY-MM-DD')) AS uuid);
    v_requested_due_date := p_measurement_date + 7;

    -- 5. UUID-Kollision absichern (Prüfen, ob die ID bereits zweckentfremdet existiert)
    SELECT project_id, created_by INTO v_col_project_id, v_col_created_by
    FROM public.project_todos
    WHERE id = v_deterministic_id;

    IF v_col_project_id IS NOT NULL THEN
        IF v_col_project_id <> p_project_id OR v_col_created_by IS DISTINCT FROM 'system:measurement_followup' THEN
            RAISE EXCEPTION 'UUID-Kollision: Die Aufgabe % existiert bereits, gehört aber zu Projekt % und wurde von % erstellt.', 
                v_deterministic_id, v_col_project_id, v_col_created_by;
        END IF;
    END IF;

    -- 6. Fall A: Trocknung beendet (drying_completed = true)
    IF p_drying_completed THEN
        WITH updated AS (
            UPDATE public.project_todos
            SET status = 'done',
                completed_at = NOW(),
                completed_by = p_user_name,
                updated_at = NOW(),
                updated_by = 'system:measurement_followup'
            WHERE project_id = p_project_id
              AND created_by = 'system:measurement_followup'
              AND status = 'open'
            RETURNING id
        )
        SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_closed_todo_ids FROM updated;

        action := 'drying_completed_clean';
        todo_id := NULL;
        due_date := NULL;
        closed_todo_ids := v_closed_todo_ids;
        created := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- 7. Fall B: Trocknung läuft noch (drying_completed = false)
    -- Ermittle das aktuell neueste offene Auto-To-do
    SELECT id, due_date INTO v_latest_open_id, v_latest_open_due_date
    FROM public.project_todos
    WHERE project_id = p_project_id
      AND created_by = 'system:measurement_followup'
      AND status = 'open'
    ORDER BY due_date DESC
    LIMIT 1;

    -- Schutz vor verspätetem Offline-Sync: Falls ein neueres offenes To-do existiert
    IF v_latest_open_due_date IS NOT NULL AND v_latest_open_due_date > v_requested_due_date THEN
        action := 'ignored_older_measurement';
        todo_id := v_latest_open_id;
        due_date := v_latest_open_due_date;
        closed_todo_ids := '{}'::uuid[];
        created := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Falls die Ziel-UUID bereits die aktive offene Aufgabe ist
    IF v_latest_open_id = v_deterministic_id THEN
        action := 'already_open';
        todo_id := v_deterministic_id;
        due_date := v_requested_due_date;
        closed_todo_ids := '{}'::uuid[];
        created := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Neue Messung ist tatsächlich neuer: Bereinige alle älteren offenen Auto-To-dos
    WITH updated AS (
        UPDATE public.project_todos
        SET status = 'done',
            completed_at = NOW(),
            completed_by = p_user_name,
            updated_at = NOW(),
            updated_by = 'system:measurement_followup'
        WHERE project_id = p_project_id
          AND created_by = 'system:measurement_followup'
          AND status = 'open'
          AND id <> v_deterministic_id
        RETURNING id
    )
    SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_closed_todo_ids FROM updated;

    -- Falls die Ziel-UUID bereits erledigt ist (nicht wieder öffnen)
    IF EXISTS (
        SELECT 1 FROM public.project_todos
        WHERE id = v_deterministic_id AND status = 'done'
    ) THEN
        action := 'already_completed';
        todo_id := v_deterministic_id;
        due_date := v_requested_due_date;
        closed_todo_ids := v_closed_todo_ids;
        created := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Neues To-do erstellen
    INSERT INTO public.project_todos (
        id,
        project_id,
        task,
        due_date,
        assigned_user_id,
        assigned_user_name,
        status,
        closes_project,
        created_by,
        updated_by,
        created_at,
        updated_at
    ) VALUES (
        v_deterministic_id,
        p_project_id,
        'Nächste Feuchtekontrolle durchführen',
        v_requested_due_date,
        'office',
        'Innendienst',
        'open',
        false,
        'system:measurement_followup',
        'system:measurement_followup',
        NOW(),
        NOW()
    );

    action := 'created';
    todo_id := v_deterministic_id;
    due_date := v_requested_due_date;
    closed_todo_ids := v_closed_todo_ids;
    created := true;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Ausführungsrechte restriktiv setzen
REVOKE EXECUTE ON FUNCTION public.sync_measurement_followup(TEXT, DATE, BOOLEAN, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_measurement_followup(TEXT, DATE, BOOLEAN, TEXT) TO authenticated;
