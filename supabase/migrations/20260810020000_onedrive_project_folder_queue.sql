create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.onedrive_project_folder_queue (
  project_id text primary key,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'complete')),
  retry_count integer not null default 0,
  folder_name text,
  remote_path text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.onedrive_project_folder_queue enable row level security;
revoke all on public.onedrive_project_folder_queue from anon, authenticated;

create or replace function public.enqueue_onedrive_project_folder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.report_data is distinct from new.report_data then
    insert into public.onedrive_project_folder_queue (
      project_id, status, retry_count, last_error, completed_at, updated_at
    ) values (
      new.id::text, 'pending', 0, null, null, now()
    )
    on conflict (project_id) do update set
      status = 'pending',
      retry_count = 0,
      last_error = null,
      completed_at = null,
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists enqueue_onedrive_project_folder_trigger on public.damage_reports;
create trigger enqueue_onedrive_project_folder_trigger
after insert or update of report_data on public.damage_reports
for each row execute function public.enqueue_onedrive_project_folder();

insert into public.onedrive_project_folder_queue (project_id, status, retry_count, updated_at)
select id::text, 'pending', 0, now()
from public.damage_reports
on conflict (project_id) do update set
  status = 'pending',
  retry_count = 0,
  last_error = null,
  completed_at = null,
  updated_at = now();

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'qtool-onedrive-project-folders';
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule(
  'qtool-onedrive-project-folders',
  '* * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1)
      || '/functions/v1/onedrive-project-folder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'onedrive_folder_worker_secret' order by created_at desc limit 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
