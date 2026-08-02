-- =====================================================================
-- QTool – Test: sync_measurement_followup
-- Dateipfad: supabase/test_sync_measurement_followup.sql
-- =====================================================================

BEGIN;

-- 1. Testumgebung aufbauen
INSERT INTO public.damage_reports (id, project_title, client, address, status, date)
VALUES ('TEST-RPC-PROJECT-2', 'Test Projekt RPC 2', 'Muster Client 2', 'Musterstrasse 2', 'Trocknung', NOW());

-- 2. Testfall A: Neue Messung vom 05.08. -> Erwartet: action='created', due_date='2026-08-12'
SELECT * FROM public.sync_measurement_followup(
    'TEST-RPC-PROJECT-2',
    '2026-08-05'::date,
    false,
    'Techniker A'
);

-- Verifikation A: Es existiert genau eine Aufgabe für Fälligkeit 2026-08-12
SELECT id, task, due_date, status, created_by FROM public.project_todos 
WHERE project_id = 'TEST-RPC-PROJECT-2';

-- 3. Testfall B: Verspätete Offline-Messung vom 01.08. -> Erwartet: action='ignored_older_measurement', todo_id des 12.08. To-dos, created=false, closed_todo_ids={}
SELECT * FROM public.sync_measurement_followup(
    'TEST-RPC-PROJECT-2',
    '2026-08-01'::date,
    false,
    'Techniker B'
);

-- Verifikation B: Das To-do vom 12.08. ist weiterhin open, kein neues To-do vom 08.08. wurde angelegt
SELECT count(*) AS open_count FROM public.project_todos
WHERE project_id = 'TEST-RPC-PROJECT-2' AND status = 'open' AND due_date = '2026-08-12';

-- 4. Testfall C: Gleiche neueste Messung vom 05.08. erneut senden -> Erwartet: action='already_open'
SELECT * FROM public.sync_measurement_followup(
    'TEST-RPC-PROJECT-2',
    '2026-08-05'::date,
    false,
    'Techniker A'
);

-- Verifikation C: Anzahl der To-dos für das Projekt bleibt 1
SELECT count(*) AS total_todos_count FROM public.project_todos 
WHERE project_id = 'TEST-RPC-PROJECT-2';

-- 5. Testfall D: UUID-Kollision mit fremdem created_by (Erwartete Exception)
-- Ziel-UUID für Messung am 15.08. simulieren:
-- md5('TEST-RPC-PROJECT-2:measurement_followup:2026-08-15') = '04494191-1fa1-e5fa-4467-f4951ce1d3ea'
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name, status, closes_project, created_by
) VALUES (
    CAST(md5('TEST-RPC-PROJECT-2:measurement_followup:2026-08-15') AS uuid),
    'TEST-RPC-PROJECT-2',
    'Manuelle Kollisions-Aufgabe',
    '2026-08-22'::date,
    '4',
    'Andreas Strehler',
    'open',
    false,
    'Andreas Strehler' -- NICHT system:measurement_followup
);

-- Aufruf von sync_measurement_followup für den 15.08. muss mit UUID-Kollisions-Exception abbrechen
DO $$
BEGIN
    BEGIN
        PERFORM public.sync_measurement_followup(
            'TEST-RPC-PROJECT-2',
            '2026-08-15'::date,
            false,
            'Techniker C'
        );
        RAISE EXCEPTION 'Unerwarteter Erfolg: UUID-Kollision wurde nicht erkannt!';
    EXCEPTION 
        WHEN OTHERS THEN
            IF SQLERRM ~ 'UUID-Kollision' THEN
                RAISE NOTICE 'Erwartete Kollisions-Exception erfolgreich gefangen: %', SQLERRM;
            ELSE
                RAISE EXCEPTION 'Unerwartete Exception: %', SQLERRM;
            END IF;
    END;
END;
$$;

ROLLBACK;
