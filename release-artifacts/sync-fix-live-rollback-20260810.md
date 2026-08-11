# QTool Sync-Fix Live Rollback — 2026-08-10

## Pre-deploy production state

- Vercel project: `bautrockner-einsatz` (`prj_VljZiy27sgCkRLWMx1l9hE1QVpuk`)
- Previous production deployment: `dpl_BXKUzB2e5GSCdwotxM2L3bZUGb7j`
- Previous immutable URL: `https://bautrockner-einsatz-ei3adi5iy-andreas-ss-projects.vercel.app`
- Supabase project: `yxdoecdqttgdncgbzyus`
- Before migration: no `public.acquire_project_lock` function and no duplicate non-null `open_project_id` rows.

## Application rollback

Reassign the production domain to deployment `dpl_BXKUzB2e5GSCdwotxM2L3bZUGb7j` using Vercel rollback/promote.

## Candidate production deployment

- New deployment: `dpl_JECiv39Ton6THn8WfgnByfdAJ477`
- Immutable URL: `https://bautrockner-einsatz-pefku5iuk-andreas-ss-projects.vercel.app`
- Pre-promotion smoke tests: root `200 text/html`; Google Static Map proxy `200 image/png`.

## Database rollback

The migration is additive and does not rewrite or delete project/report/photo data. To restore the verified pre-deploy schema:

```sql
DROP FUNCTION IF EXISTS public.acquire_project_lock(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP INDEX IF EXISTS public.project_sessions_unique_active_project;
NOTIFY pgrst, 'reload schema';
```
