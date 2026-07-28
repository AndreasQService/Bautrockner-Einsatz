-- =====================================================================
-- QTool – Auto-To-Dos Rollback Script (13 Candidates)
-- Dateipfad: scripts/rollback_13_measurement_todos.sql
-- =====================================================================

BEGIN;

DELETE FROM public.project_todos
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
) AND created_by = 'system:measurement_followup';

COMMIT;

-- Verifikationsabfrage: Zeigt an, wie viele der 13 Ziel-UUIDs noch vorhanden sind (Erwartet: 0)
SELECT count(*) AS remaining_candidates_count
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
);
