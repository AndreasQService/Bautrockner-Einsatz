-- =====================================================================
-- QTool – Test: complete_todo_with_successor
-- Dateipfad: supabase/test_complete_todo_with_successor.sql
-- =====================================================================

BEGIN;

-- 1. Testumgebung aufbauen
INSERT INTO public.damage_reports (id, project_title, client, address, status, date)
VALUES ('TEST-RPC-PROJECT-1', 'Test Projekt RPC 1', 'Muster Client', 'Musterstrasse 1', 'Trocknung', NOW());

-- Vorgänger-To-do erstellen
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name, status, closes_project, created_by
) VALUES (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'TEST-RPC-PROJECT-1',
    'Erstes manuelles To-do',
    '2026-08-01'::date,
    '4',
    'Andreas Strehler',
    'open',
    false,
    'Andreas Strehler'
);

-- 2. Testfall A: Regulärer Abschluss mit Nachfolger
SELECT * FROM public.complete_todo_with_successor(
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Zweites manuelles To-do',
    '2026-08-08'::date,
    '4',
    'Andreas Strehler',
    'Testnotiz',
    'Andreas Strehler'
);

-- Verifikation A: Vorgänger done, Nachfolger open, parent_todo_id verkettet
SELECT id, project_id, status, parent_todo_id, root_todo_id, completed_by FROM public.project_todos 
WHERE id IN ('11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid)
ORDER BY created_at ASC;

-- 3. Testfall B: Bereits erledigten Vorgänger erneut abschließen (Erwarteter Fehler: "ist nicht offen")
-- Der Block muss fehlschlagen, falls die Ausführung fälschlicherweise klappt.
DO $$
DECLARE
    v_old UUID;
    v_new UUID;
BEGIN
    BEGIN
        SELECT old_id, new_id INTO v_old, v_new FROM public.complete_todo_with_successor(
            '11111111-1111-1111-1111-111111111111'::uuid,
            '33333333-3333-3333-3333-333333333333'::uuid,
            'Drittes To-do',
            '2026-08-15'::date,
            '4',
            'Andreas Strehler',
            NULL,
            'Andreas Strehler'
        );
        -- Falls kein Fehler geworfen wurde, lassen wir den Test fehlschlagen
        RAISE EXCEPTION 'Unerwarteter Erfolg: Erledigte Aufgabe konnte erneut abgeschlossen werden!';
    EXCEPTION 
        WHEN OTHERS THEN
            -- Prüfen, ob die Fehlermeldung den erwarteten Teilstring enthält
            IF SQLERRM ~ 'ist nicht offen' THEN
                RAISE NOTICE 'Erwarteter Fehler erfolgreich gefangen: %', SQLERRM;
            ELSE
                -- Falls es eine andere Exception war, werfen wir sie weiter, damit der Test scheitert
                RAISE EXCEPTION 'Unerwarteter Fehler: %', SQLERRM;
            END IF;
    END;
END;
$$;

-- 4. Testfall C: Completed Status Check Constraint verifizieren
-- Versuch, ein To-do fälschlicherweise auf done zu setzen ohne completed_at / completed_by
SAVEPOINT before_constraint_test;

DO $$
BEGIN
    UPDATE public.project_todos
    SET status = 'done'
    WHERE id = '22222222-2222-2222-2222-222222222222'::uuid;
    RAISE EXCEPTION 'Fehler: Completed-Status Check-Constraint wurde umgangen!';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ~ 'violates check constraint' OR SQLERRM ~ 'completed_status_check' THEN
        RAISE NOTICE 'Erwarteter Constraint-Fehler erfolgreich gefangen: %', SQLERRM;
    ELSE
        RAISE EXCEPTION 'Unerwarteter Constraint-Fehler: %', SQLERRM;
    END IF;
END;
$$;

ROLLBACK TO SAVEPOINT before_constraint_test;

ROLLBACK;
