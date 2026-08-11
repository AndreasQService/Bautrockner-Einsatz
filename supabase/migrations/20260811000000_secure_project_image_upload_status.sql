create or replace function public.get_project_image_upload_status(
  p_project_id text,
  p_local_image_id text
)
returns table(storage_status text, remote_item_id text, remote_path text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.storage_status, p.remote_item_id, p.remote_path
  from public.project_image_uploads p
  where p.project_id = p_project_id
    and p.local_image_id = p_local_image_id
  limit 1;
$$;

revoke all on function public.get_project_image_upload_status(text, text) from public;
grant execute on function public.get_project_image_upload_status(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
