begin;

-- These legacy/internal tables have no browser grants in production. RLS is
-- still enabled as a second boundary so a future grant cannot expose rows by
-- accident. Runtime project locking uses the authenticated RPC contract.
alter table if exists public.reports enable row level security;
alter table if exists public.audit_log enable row level security;
alter table if exists public.project_sessions enable row level security;

revoke all on table public.reports from public, anon, authenticated;
revoke all on table public.audit_log from public, anon, authenticated;
revoke all on table public.project_sessions from public, anon, authenticated;

-- Trigger functions never need client EXECUTE. The two legacy image journal
-- RPCs are not used by the current frontend and do not enforce the current
-- project-lock/header contract, so they remain inaccessible to browser roles.
revoke all on function public.enqueue_onedrive_project_folder()
  from public, anon, authenticated;
revoke all on function public.enqueue_project_image_upload(text,text,text,text,bigint,text,text,text,text)
  from public, anon, authenticated;
revoke all on function public.get_project_image_upload_status(text,text)
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
