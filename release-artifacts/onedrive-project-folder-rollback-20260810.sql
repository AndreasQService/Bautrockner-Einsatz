-- Additive rollback. It stops automatic processing and removes only queue metadata.
-- It does not delete or modify projects, images, reports, or OneDrive folders/files.
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

drop trigger if exists enqueue_onedrive_project_folder_trigger on public.damage_reports;
drop function if exists public.enqueue_onedrive_project_folder();
drop table if exists public.onedrive_project_folder_queue;
