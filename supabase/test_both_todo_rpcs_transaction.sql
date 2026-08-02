-- =====================================================================
-- QTool – Combined Transaction Test Script (SELECT ONLY)
-- Dateipfad: supabase/test_both_todo_rpcs_transaction.sql
-- =====================================================================

BEGIN;

-- 1. RPC complete_todo_with_successor erstellen
CREATE OR REPLACE FUNCTION public.complete_todo_with_successor(
    p_todo_id UUID,
    p_successor_id UUID,
    p_successor_task TEXT,
    p_successor_due_date DATE,
    p_successor_user_id TEXT,
    p_successor_user_name TEXT,
    p_successor_note TEXT,
    p_user_name TEXT
) RETURNS TABLE (
    old_id UUID,
    new_id UUID
) AS $$
DECLARE
    v_prev_project_id TEXT;
    v_prev_root_todo_id UUID;
    v_prev_status TEXT;
BEGIN
    IF p_todo_id IS NULL THEN
        RAISE EXCEPTION 'Vorgänger-To-do-ID darf nicht NULL sein.';
    END IF;
    IF p_successor_id IS NULL THEN
        RAISE EXCEPTION 'Nachfolger-To-do-ID (p_successor_id) darf nicht NULL sein.';
    END IF;
    IF p_successor_task IS NULL OR char_length(trim(p_successor_task)) = 0 THEN
        RAISE EXCEPTION 'Nachfolger-Aufgabe (p_successor_task) darf nicht leer sein.';
    END IF;
    IF p_successor_due_date IS NULL THEN
        RAISE EXCEPTION 'Nachfolger-Fälligkeitsdatum (p_successor_due_date) darf nicht NULL sein.';
    END IF;
    IF p_successor_user_id IS NULL OR char_length(trim(p_successor_user_id)) = 0 THEN
        RAISE EXCEPTION 'Nachfolger-Benutzer-ID (p_successor_user_id) darf nicht leer sein.';
    END IF;
    IF p_successor_user_name IS NULL OR char_length(trim(p_successor_user_name)) = 0 THEN
        RAISE EXCEPTION 'Nachfolger-Benutzername (p_successor_user_name) darf nicht leer sein.';
    END IF;
    IF p_user_name IS NULL OR char_length(trim(p_user_name)) = 0 THEN
        RAISE EXCEPTION 'Abschließender Benutzername (p_user_name) darf nicht leer sein.';
    END IF;

    SELECT status, project_id, root_todo_id 
    INTO v_prev_status, v_prev_project_id, v_prev_root_todo_id
    FROM public.project_todos
    WHERE id = p_todo_id
    FOR UPDATE;

    IF v_prev_status IS NULL THEN
        RAISE EXCEPTION 'Vorgänger-Aufgabe % existiert nicht.', p_todo_id;
    END IF;

    IF v_prev_status <> 'open' THEN
        RAISE EXCEPTION 'Vorgänger-Aufgabe % ist nicht offen (Status: %).', p_todo_id, v_prev_status;
    END IF;

    INSERT INTO public.project_todos (
        id, project_id, task, due_date, assigned_user_id, assigned_user_name,
        note, status, closes_project, parent_todo_id, root_todo_id,
        created_by, updated_by, created_at, updated_at
    ) VALUES (
        p_successor_id, v_prev_project_id, p_successor_task, p_successor_due_date,
        p_successor_user_id, p_successor_user_name, p_successor_note, 'open',
        false, p_todo_id, COALESCE(v_prev_root_todo_id, p_todo_id),
        p_user_name, p_user_name, NOW(), NOW()
    );

    UPDATE public.project_todos
    SET status = 'done', completed_at = NOW(), completed_by = p_user_name,
        updated_at = NOW(), updated_by = p_user_name
    WHERE id = p_todo_id;

    old_id := p_todo_id;
    new_id := p_successor_id;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- 2. RPC sync_measurement_followup erstellen
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

    PERFORM pg_advisory_xact_lock(hashtext(p_project_id));

    IF NOT EXISTS (SELECT 1 FROM public.damage_reports WHERE id = p_project_id) THEN
        RAISE EXCEPTION 'Projekt % existiert nicht.', p_project_id;
    END IF;

    v_deterministic_id := CAST(md5(p_project_id || ':measurement_followup:' || to_char(p_measurement_date, 'YYYY-MM-DD')) AS uuid);
    v_requested_due_date := p_measurement_date + 7;

    SELECT project_id, created_by INTO v_col_project_id, v_col_created_by
    FROM public.project_todos
    WHERE id = v_deterministic_id;

    IF v_col_project_id IS NOT NULL THEN
        IF v_col_project_id <> p_project_id OR v_col_created_by IS DISTINCT FROM 'system:measurement_followup' THEN
            RAISE EXCEPTION 'UUID-Kollision: Die Aufgabe % existiert bereits, gehört aber zu Projekt % und wurde von % erstellt.', 
                v_deterministic_id, v_col_project_id, v_col_created_by;
        END IF;
    END IF;

    IF p_drying_completed THEN
        WITH updated AS (
            UPDATE public.project_todos
            SET status = 'done', completed_at = NOW(), completed_by = p_user_name,
                updated_at = NOW(), updated_by = 'system:measurement_followup'
            WHERE project_id = p_project_id AND created_by = 'system:measurement_followup' AND status = 'open'
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

    SELECT id, due_date INTO v_latest_open_id, v_latest_open_due_date
    FROM public.project_todos
    WHERE project_id = p_project_id AND created_by = 'system:measurement_followup' AND status = 'open'
    ORDER BY due_date DESC LIMIT 1;

    IF v_latest_open_due_date IS NOT NULL AND v_latest_open_due_date > v_requested_due_date THEN
        action := 'ignored_older_measurement';
        todo_id := v_latest_open_id;
        due_date := v_latest_open_due_date;
        closed_todo_ids := '{}'::uuid[];
        created := false;
        RETURN NEXT;
        RETURN;
    END IF;

    IF v_latest_open_id = v_deterministic_id THEN
        action := 'already_open';
        todo_id := v_deterministic_id;
        due_date := v_requested_due_date;
        closed_todo_ids := '{}'::uuid[];
        created := false;
        RETURN NEXT;
        RETURN;
    END IF;

    WITH updated AS (
        UPDATE public.project_todos
        SET status = 'done', completed_at = NOW(), completed_by = p_user_name,
            updated_at = NOW(), updated_by = 'system:measurement_followup'
        WHERE project_id = p_project_id AND created_by = 'system:measurement_followup' AND status = 'open' AND id <> v_deterministic_id
        RETURNING id
    )
    SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_closed_todo_ids FROM updated;

    IF EXISTS (
        SELECT 1 FROM public.project_todos WHERE id = v_deterministic_id AND status = 'done'
    ) THEN
        action := 'already_completed';
        todo_id := v_deterministic_id;
        due_date := v_requested_due_date;
        closed_todo_ids := v_closed_todo_ids;
        created := false;
        RETURN NEXT;
        RETURN;
    END IF;

    INSERT INTO public.project_todos (
        id, project_id, task, due_date, assigned_user_id, assigned_user_name,
        status, closes_project, created_by, updated_by, created_at, updated_at
    ) VALUES (
        v_deterministic_id, p_project_id, 'Nächste Feuchtekontrolle durchführen', v_requested_due_date,
        'office', 'Innendienst', 'open', false, 'system:measurement_followup', 'system:measurement_followup', NOW(), NOW()
    );

    action := 'created';
    todo_id := v_deterministic_id;
    due_date := v_requested_due_date;
    closed_todo_ids := v_closed_todo_ids;
    created := true;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- 3. Testumgebung aufbauen
INSERT INTO public.damage_reports (id, project_title, client, address, status, date)
VALUES 
  ('TEST-RPC-COMBINED-1', 'Test Projekt RPC 1', 'Muster Client', 'Musterstrasse 1', 'Trocknung', NOW()),
  ('TEST-RPC-COMBINED-2', 'Test Projekt RPC 2', 'Muster Client 2', 'Musterstrasse 2', 'Trocknung', NOW());

-- 4. Tests für complete_todo_with_successor
-- A. Vorgänger einfügen
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name, status, closes_project, created_by
) VALUES (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'TEST-RPC-COMBINED-1',
    'Erstes To-do',
    '2026-08-01'::date,
    '4',
    'Andreas Strehler',
    'open',
    false,
    'Andreas Strehler'
);

-- B. Manuelles Erledigen erstellt genau einen Nachfolger; Vorgänger wird erst danach done
DO $$
DECLARE
    v_old_id UUID;
    v_new_id UUID;
    v_status TEXT;
    v_parent_id UUID;
BEGIN
    SELECT old_id, new_id INTO v_old_id, v_new_id FROM public.complete_todo_with_successor(
        '11111111-1111-1111-1111-111111111111'::uuid,
        '22222222-2222-2222-2222-222222222222'::uuid,
        'Zweites To-do',
        '2026-08-08'::date,
        '4',
        'Andreas Strehler',
        'Notiz',
        'Andreas Strehler'
    );

    IF v_old_id IS DISTINCT FROM '11111111-1111-1111-1111-111111111111'::uuid OR v_new_id IS DISTINCT FROM '22222222-2222-2222-2222-222222222222'::uuid THEN
        RAISE EXCEPTION 'Assertion fehlgeschlagen: complete_todo_with_successor Rückgabewerte fehlerhaft.';
    END IF;

    -- Überprüfe Status und Verkettung
    SELECT status INTO v_status FROM public.project_todos WHERE id = '11111111-1111-1111-1111-111111111111'::uuid;
    IF v_status IS DISTINCT FROM 'done' THEN
        RAISE EXCEPTION 'Assertion fehlgeschlagen: Vorgänger-Aufgabe ist nicht done.';
    END IF;

    SELECT status, parent_todo_id INTO v_status, v_parent_id FROM public.project_todos WHERE id = '22222222-2222-2222-2222-222222222222'::uuid;
    IF v_status IS DISTINCT FROM 'open' OR v_parent_id IS DISTINCT FROM '11111111-1111-1111-1111-111111111111'::uuid THEN
        RAISE EXCEPTION 'Assertion fehlgeschlagen: Nachfolger-Aufgabe falsch erstellt.';
    END IF;
END;
$$;

-- C. Doppelaufruf scheitert
DO $$
BEGIN
    BEGIN
        PERFORM public.complete_todo_with_successor(
            '11111111-1111-1111-1111-111111111111'::uuid,
            '33333333-3333-3333-3333-333333333333'::uuid,
            'Drittes To-do',
            '2026-08-15'::date,
            '4',
            'Andreas Strehler',
            NULL,
            'Andreas Strehler'
        );
        RAISE EXCEPTION 'Assertion fehlgeschlagen: Doppelaufruf scheiterte nicht.';
    EXCEPTION 
        WHEN OTHERS THEN
            IF SQLERRM ~ 'ist nicht offen' THEN
                RAISE NOTICE 'Erwarteter Doppelaufruf-Fehler erfolgreich gefangen: %', SQLERRM;
            ELSE
                RAISE EXCEPTION 'Unerwarteter Fehler beim Doppelaufruf: %', SQLERRM;
            END IF;
    END;
END;
$$;

-- 5. Tests für sync_measurement_followup
-- A. Erste Messung erzeugt Auto-To-do
DO $$
DECLARE
    v_action TEXT;
    v_todo_id UUID;
    v_due_date DATE;
    v_closed UUID[];
    v_created BOOLEAN;
BEGIN
    SELECT action, todo_id, due_date, closed_todo_ids, created 
    INTO v_action, v_todo_id, v_due_date, v_closed, v_created
    FROM public.sync_measurement_followup(
        'TEST-RPC-COMBINED-2',
        '2026-08-05'::date,
        false,
        'Techniker A'
    );

    IF v_action IS DISTINCT FROM 'created' OR v_created IS NOT true OR v_due_date IS DISTINCT FROM '2026-08-12'::date THEN
        RAISE EXCEPTION 'Assertion fehlgeschlagen: Erste Messung nicht korrekt verarbeitet.';
    END IF;
END;
$$;

-- B. Gleiche Messung erzeugt kein Duplikat
DO $$
DECLARE
    v_action TEXT;
    v_created BOOLEAN;
    v_count INT;
BEGIN
    SELECT action, created INTO v_action, v_created
    FROM public.sync_measurement_followup(
        'TEST-RPC-COMBINED-2',
        '2026-08-05'::date,
        false,
        'Techniker A'
    );

    IF v_action IS DISTINCT FROM 'already_open' OR v_created IS NOT false THEN
        RAISE EXCEPTION 'Assertion fehlgeschlagen: Gleiche Messung erzeugte fälschlicherweise Duplikat oder Aktion falsch.';
    END IF;

    SELECT count(*) INTO v_count FROM public.project_todos WHERE project_id = 'TEST-RPC-COMBINED-2';
    IF v_count IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'Assertion fehlgeschlagen: Mehr als eine Aufgabe vorhanden.';
    END IF;
END;
$$;

-- C. Verspätete ältere iPad-Messung ergibt ignored_older_measurement und verändert nichts
DO $$
DECLARE
    v_action TEXT;
    v_created BOOLEAN;
    v_status TEXT;
BEGIN
    SELECT action, created INTO v_action, v_created
    FROM public.sync_measurement_followup(
        'TEST-RPC-COMBINED-2',
        '2026-08-01'::date,
        false,
        'Techniker B'
    );

    IF v_action IS DISTINCT FROM 'ignored_older_measurement' OR v_created IS NOT false THEN
        RAISE EXCEPTION 'Assertion fehlgeschlagen: Veraltete iPad-Messung wurde nicht ignoriert.';
    END IF;

    SELECT status INTO v_status FROM public.project_todos 
    WHERE id = CAST(md5('TEST-RPC-COMBINED-2:measurement_followup:2026-08-05') AS uuid);
    IF v_status IS DISTINCT FROM 'open' THEN
        RAISE EXCEPTION 'Assertion fehlgeschlagen: Neuere Aufgabe wurde fälschlicherweise geschlossen.';
    END IF;
END;
$$;

-- D. Neuere Messung schliesst das alte Auto-To-do und erstellt eines
DO $$
DECLARE
    v_action TEXT;
    v_created BOOLEAN;
    v_closed UUID[];
    v_status TEXT;
    v_old_target_id UUID;
BEGIN
    v_old_target_id := CAST(md5('TEST-RPC-COMBINED-2:measurement_followup:2026-08-05') AS uuid);

    SELECT action, created, closed_todo_ids INTO v_action, v_created, v_closed
    FROM public.sync_measurement_followup(
        'TEST-RPC-COMBINED-2',
        '2026-08-10'::date,
        false,
        'Techniker B'
    );

    IF v_action IS DISTINCT FROM 'created' OR v_created IS NOT true OR array_position(v_closed, v_old_target_id) IS NULL THEN
        RAISE EXCEPTION 'Assertion fehlgeschlagen: Neue Messung hat alte Aufgabe nicht beendet.';
    END IF;

    SELECT status INTO v_status FROM public.project_todos WHERE id = v_old_target_id;
    IF v_status IS DISTINCT FROM 'done' THEN
        RAISE EXCEPTION 'Assertion fehlgeschlagen: Altes Auto-To-do ist nicht im Status done.';
    END IF;
END;
$$;

-- E. dryingCompleted=true schliesst offene Auto-To-dos und erstellt keines
DO $$
DECLARE
    v_action TEXT;
    v_created BOOLEAN;
    v_closed UUID[];
    v_new_target_id UUID;
    v_count INT;
BEGIN
    v_new_target_id := CAST(md5('TEST-RPC-COMBINED-2:measurement_followup:2026-08-10') AS uuid);

    SELECT action, created, closed_todo_ids INTO v_action, v_created, v_closed
    FROM public.sync_measurement_followup(
        'TEST-RPC-COMBINED-2',
        '2026-08-15'::date,
        true,
        'Techniker C'
    );

    IF v_action IS DISTINCT FROM 'drying_completed_clean' OR v_created IS NOT false OR array_position(v_closed, v_new_target_id) IS NULL THEN
        RAISE EXCEPTION 'Assertion fehlgeschlagen: Trocknungsende schloss verbleibende Aufgaben nicht sauber.';
    END IF;

    SELECT count(*) INTO v_count FROM public.project_todos 
    WHERE project_id = 'TEST-RPC-COMBINED-2' AND status = 'open' AND created_by = 'system:measurement_followup';
    
    IF v_count IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'Assertion fehlgeschlagen: Es existieren weiterhin offene automatische Feuchtekontrollen.';
    END IF;
END;
$$;

-- F. UUID-Kollision wird abgewiesen
-- Wir simulieren eine Kollision am 20.08.
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name, status, closes_project, created_by
) VALUES (
    CAST(md5('TEST-RPC-COMBINED-2:measurement_followup:2026-08-20') AS uuid),
    'TEST-RPC-COMBINED-2',
    'Manuelle Kollisionsaufgabe',
    '2026-08-27'::date,
    '4',
    'Andreas Strehler',
    'open',
    false,
    'Andreas Strehler' -- Nicht system:measurement_followup
);

DO $$
BEGIN
    BEGIN
        PERFORM public.sync_measurement_followup(
            'TEST-RPC-COMBINED-2',
            '2026-08-20'::date,
            false,
            'Techniker A'
        );
        RAISE EXCEPTION 'Assertion fehlgeschlagen: UUID-Kollision wurde nicht abgewiesen.';
    EXCEPTION 
        WHEN OTHERS THEN
            IF SQLERRM ~ 'UUID-Kollision' THEN
                RAISE NOTICE 'Kollisions-Fehler wie erwartet gefangen: %', SQLERRM;
            ELSE
                RAISE EXCEPTION 'Unerwarteter Fehler bei UUID-Kollisions-Test: %', SQLERRM;
            END IF;
    END;
END;
$$;

-- Alle Tests bestanden!

ROLLBACK;
