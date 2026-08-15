-- Test-only release migration: durable exact-drive byte evidence.
alter table public.project_image_uploads
  add column if not exists remote_drive_id text,
  add column if not exists remote_size_bytes bigint,
  add column if not exists remote_sha256 text;

alter table public.project_image_uploads
  drop constraint if exists project_image_uploads_remote_proof_complete;

alter table public.project_image_uploads
  add constraint project_image_uploads_remote_proof_complete check (
    storage_status <> 'remote_verified'
    or (
      remote_drive_id is not null
      and remote_item_id is not null
      and remote_etag is not null
      and remote_size_bytes is not null
      and remote_sha256 ~ '^[a-f0-9]{64}$'
      and verified_at is not null
    )
  ) not valid;

comment on column public.project_image_uploads.remote_drive_id is
  'Drive ID used by backend service principal for exact /drives/{driveId} byte readback.';

create or replace function public.clear_stale_onedrive_proof()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.sha256 is distinct from new.sha256
     or old.size_bytes is distinct from new.size_bytes
     or old.storage_path is distinct from new.storage_path
     or old.remote_path is distinct from new.remote_path then
    new.storage_status := 'uploaded_to_backend';
    new.remote_drive_id := null;
    new.remote_item_id := null;
    new.remote_etag := null;
    new.remote_size_bytes := null;
    new.remote_sha256 := null;
    new.verified_at := null;
    new.retry_count := 0;
    new.last_error := null;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_stale_onedrive_proof_before_update on public.project_image_uploads;
create trigger clear_stale_onedrive_proof_before_update
before update on public.project_image_uploads
for each row execute function public.clear_stale_onedrive_proof();
