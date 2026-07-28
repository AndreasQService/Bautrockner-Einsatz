-- =====================================================================
-- QTool – Auto-To-Dos Migration Script (13 Candidates)
-- Dateipfad: scripts/migrate_13_measurement_todos.sql
-- =====================================================================

BEGIN;

-- Projekt ID 45bdd320... (Fälligkeit 2026-06-08)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    'c28da8d4-cb0b-b142-09e3-f850cd4d2636'::uuid,
    '45bdd320-e884-4a0f-a2be-c271163d1689',
    'Nächste Feuchtekontrolle durchführen',
    '2026-06-08'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = '45bdd320-e884-4a0f-a2be-c271163d1689'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = '45bdd320-e884-4a0f-a2be-c271163d1689'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;

-- Projekt ID 63c6d591... (Fälligkeit 2026-07-21)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    'e6a3a79a-1993-3c5d-08e2-aa096bd6a0a1'::uuid,
    '63c6d591-181a-448d-944b-fa86c9a80bab',
    'Nächste Feuchtekontrolle durchführen',
    '2026-07-21'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = '63c6d591-181a-448d-944b-fa86c9a80bab'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = '63c6d591-181a-448d-944b-fa86c9a80bab'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;

-- Projekt ID P-177822... (Fälligkeit 2026-07-06)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    '5307e65f-dfd3-0419-f547-602bf73cee56'::uuid,
    'P-1778223875749',
    'Nächste Feuchtekontrolle durchführen',
    '2026-07-06'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = 'P-1778223875749'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = 'P-1778223875749'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;

-- Projekt ID 45519d7d... (Fälligkeit 2026-06-10)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    '82d6236f-fd55-e0b6-5e11-a4660fb76d52'::uuid,
    '45519d7d-5cfb-440f-a9e2-2666ea04654e',
    'Nächste Feuchtekontrolle durchführen',
    '2026-06-10'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = '45519d7d-5cfb-440f-a9e2-2666ea04654e'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = '45519d7d-5cfb-440f-a9e2-2666ea04654e'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;

-- Projekt ID e936cf9f... (Fälligkeit 2026-05-17)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    '495f5d2f-8a43-c604-9aa7-c3713ded57a1'::uuid,
    'e936cf9f-186e-484d-845a-72621967248c',
    'Nächste Feuchtekontrolle durchführen',
    '2026-05-17'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = 'e936cf9f-186e-484d-845a-72621967248c'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = 'e936cf9f-186e-484d-845a-72621967248c'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;

-- Projekt ID 20260065... (Fälligkeit 2026-04-10)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    '96cec8d4-00e6-fab9-09f4-de88d42c7d30'::uuid,
    '20260065',
    'Nächste Feuchtekontrolle durchführen',
    '2026-04-10'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = '20260065'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = '20260065'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;

-- Projekt ID 2026001... (Fälligkeit 2026-06-10)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    '845a862a-3081-90aa-0c78-51d7676efadb'::uuid,
    '2026001',
    'Nächste Feuchtekontrolle durchführen',
    '2026-06-10'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = '2026001'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = '2026001'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;

-- Projekt ID 20260160... (Fälligkeit 2026-04-09)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    '65f3f4d8-5267-f5a1-7ec1-dc2c336d1ab1'::uuid,
    '20260160',
    'Nächste Feuchtekontrolle durchführen',
    '2026-04-09'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = '20260160'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = '20260160'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;

-- Projekt ID 2026... (Fälligkeit 2026-04-01)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    '38974937-caad-4d73-b936-e0856fa76a3a'::uuid,
    '2026',
    'Nächste Feuchtekontrolle durchführen',
    '2026-04-01'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = '2026'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = '2026'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;

-- Projekt ID 20260125... (Fälligkeit 2026-05-16)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    'e12a87f6-e49c-9b95-5752-a7ab2b413b8f'::uuid,
    '20260125',
    'Nächste Feuchtekontrolle durchführen',
    '2026-05-16'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = '20260125'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = '20260125'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;

-- Projekt ID 23252441... (Fälligkeit 2026-05-22)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    '435c26a1-ed94-3108-be7a-04c116c461c7'::uuid,
    '23252441-1446-45d1-93db-e971f3b8f062',
    'Nächste Feuchtekontrolle durchführen',
    '2026-05-22'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = '23252441-1446-45d1-93db-e971f3b8f062'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = '23252441-1446-45d1-93db-e971f3b8f062'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;

-- Projekt ID 8b130f33... (Fälligkeit 2026-07-28)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    'decba4e7-3fb1-bc77-1e05-50c317bed3e0'::uuid,
    '8b130f33-e10a-43c4-9af9-f08588590068',
    'Nächste Feuchtekontrolle durchführen',
    '2026-07-28'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = '8b130f33-e10a-43c4-9af9-f08588590068'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = '8b130f33-e10a-43c4-9af9-f08588590068'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;

-- Projekt ID 5154e30a... (Fälligkeit 2026-08-04)
INSERT INTO public.project_todos (
    id, project_id, task, due_date, assigned_user_id, assigned_user_name,
    status, closes_project, created_by, updated_by
)
SELECT
    'dcf6a968-5d93-1839-2ebd-70859560bb68'::uuid,
    '5154e30a-26fe-4ec2-989c-bf66433a0e95',
    'Nächste Feuchtekontrolle durchführen',
    '2026-08-04'::date,
    'office',
    'Innendienst',
    'open',
    false,
    'system:measurement_followup',
    'system:measurement_followup'
WHERE EXISTS (
    SELECT 1 FROM public.damage_reports dr
    WHERE dr.id = '5154e30a-26fe-4ec2-989c-bf66433a0e95'
      AND COALESCE(dr.report_data->>'dryingCompleted', 'false') <> 'true'
)
  AND NOT EXISTS (
    SELECT 1 FROM public.project_todos pt
    WHERE pt.project_id = '5154e30a-26fe-4ec2-989c-bf66433a0e95'
      AND pt.status = 'open'
      AND pt.created_by = 'system:measurement_followup'
)
ON CONFLICT (id) DO NOTHING;
COMMIT;

-- Verifikationsabfrage: Anzeigen der 13 migrierten Datensätze
SELECT 
    id, 
    project_id, 
    task, 
    due_date, 
    status, 
    created_by 
FROM public.project_todos
WHERE id IN (
    'c28da8d4-cb0b-b142-09e3-f850cd4d2636'::uuid,
    'e6a3a79a-1993-3c5d-08e2-aa096bd6a0a1'::uuid,
    '5307e65f-dfd3-0419-f547-602bf73cee56'::uuid,
    '82d6236f-fd55-e0b6-5e11-a4660fb76d52'::uuid,
    '495f5d2f-8a43-c604-9aa7-c3713ded57a1'::uuid,
    '96cec8d4-00e6-fab9-09f4-de88d42c7d30'::uuid,
    '845a862a-3081-90aa-0c78-51d7676efadb'::uuid,
    '65f3f4d8-5267-f5a1-7ec1-dc2c336d1ab1'::uuid,
    '38974937-caad-4d73-b936-e0856fa76a3a'::uuid,
    'e12a87f6-e49c-9b95-5752-a7ab2b413b8f'::uuid,
    '435c26a1-ed94-3108-be7a-04c116c461c7'::uuid,
    'decba4e7-3fb1-bc77-1e05-50c317bed3e0'::uuid,
    'dcf6a968-5d93-1839-2ebd-70859560bb68'::uuid
)
ORDER BY due_date ASC;
