begin;

create or replace function public.qtool_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role = 'admin'
  );
$function$;

revoke all on function public.qtool_is_admin() from public, anon;
grant execute on function public.qtool_is_admin() to authenticated;

create table if not exists public.rental_devices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  report_id text references public.damage_reports(id) on delete cascade,
  device_type text not null,
  device_number text,
  start_date date,
  end_date date,
  notes text,
  catalog_id uuid references public.device_catalog(id),
  apartment text,
  room text,
  counter_start text,
  runtime_hours text,
  created_by uuid references auth.users(id)
);

alter table public.rental_devices enable row level security;
revoke all on table public.rental_devices from public, anon, authenticated;
grant select, insert, update, delete on table public.rental_devices to authenticated;

create unique index if not exists rental_devices_active_number_uidx
  on public.rental_devices (upper(btrim(device_number)))
  where end_date is null and nullif(btrim(device_number), '') is not null;

alter table public.device_catalog
  add column if not exists catalog_status text not null default 'approved',
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id);

alter table public.device_catalog drop constraint if exists device_catalog_catalog_status_check;
alter table public.device_catalog add constraint device_catalog_catalog_status_check
  check (catalog_status in ('approved', 'provisional'));

drop policy if exists qtool_owner_select on public.rental_devices;
drop policy if exists qtool_owner_insert on public.rental_devices;
drop policy if exists qtool_owner_update on public.rental_devices;
drop policy if exists qtool_owner_delete on public.rental_devices;
create policy qtool_owner_select on public.rental_devices for select to authenticated
  using (exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.is_active = true
  ));
create policy qtool_owner_insert on public.rental_devices for insert to authenticated
  with check (public.qtool_has_project_write_lock(report_id));
create policy qtool_owner_update on public.rental_devices for update to authenticated
  using (public.qtool_has_project_write_lock(report_id))
  with check (public.qtool_has_project_write_lock(report_id));
create policy qtool_owner_delete on public.rental_devices for delete to authenticated
  using (public.qtool_is_admin() and public.qtool_has_project_write_lock(report_id));

do $policies$
declare
  item record;
begin
  for item in select * from (values
    ('damage_reports','id'),
    ('damage_report_rooms','report_id'),
    ('measurement_protocols','report_id'),
    ('project_image_uploads','project_id'),
    ('onedrive_project_folder_queue','project_id'),
    ('onedrive_sync_queue','project_id'),
    ('project_todos','project_id'),
    ('case_documents','case_id'),
    ('case_extractions','case_id'),
    ('qtool_operations','report_id')
  ) as x(table_name, project_column)
  loop
    if to_regclass('public.' || item.table_name) is not null then
      execute format('drop policy if exists qtool_owner_delete on public.%I', item.table_name);
      execute format(
        'create policy qtool_owner_delete on public.%I for delete to authenticated using (public.qtool_is_admin() and public.qtool_has_project_write_lock(%I::text))',
        item.table_name, item.project_column
      );
    end if;
  end loop;
end
$policies$;

drop policy if exists qtool_owner_delete on public.room_measurements;
create policy qtool_owner_delete on public.room_measurements for delete to authenticated
  using (public.qtool_is_admin() and public.qtool_room_has_project_write_lock(room_id));

drop policy if exists public_delete_devices on public.devices;
drop policy if exists public_delete_device_catalog on public.device_catalog;
drop policy if exists qtool_admin_delete on public.devices;
drop policy if exists qtool_admin_delete on public.device_catalog;
create policy qtool_admin_delete on public.devices for delete to authenticated
  using (public.qtool_is_admin());
create policy qtool_admin_delete on public.device_catalog for delete to authenticated
  using (public.qtool_is_admin());

drop policy if exists "Allow Delete for Authenticated to Case Files" on storage.objects;
drop policy if exists qtool_admin_delete_case_files on storage.objects;
create policy qtool_admin_delete_case_files on storage.objects for delete to authenticated
  using (bucket_id = 'case-files' and public.qtool_is_admin());

create or replace function public.create_rental_device_assignment(
  p_report_id text,
  p_device_number text,
  p_catalog_id uuid default null,
  p_new_type_name text default null,
  p_start_date date default null,
  p_apartment text default null,
  p_room text default null,
  p_counter_start text default null,
  p_runtime_hours text default null
)
returns table (rental_device_id uuid, catalog_id uuid, device_type text, catalog_status text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_number text := upper(btrim(coalesce(p_device_number, '')));
  v_type text := btrim(coalesce(p_new_type_name, ''));
  v_catalog public.device_catalog%rowtype;
  v_rental_id uuid;
begin
  if v_uid is null or not exists (
    select 1 from public.user_profiles p where p.id = v_uid and p.is_active = true
  ) then raise exception 'AUTHENTICATED_ACTIVE_USER_REQUIRED' using errcode = '42501'; end if;
  if nullif(btrim(coalesce(p_report_id, '')), '') is null
     or not public.qtool_has_project_write_lock(p_report_id) then
    raise exception 'PROJECT_WRITE_LOCK_REQUIRED' using errcode = '42501';
  end if;
  if v_number = '' then raise exception 'RENTAL_NUMBER_REQUIRED' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qtool-rental:' || v_number, 0));
  if exists (select 1 from public.rental_devices r where r.end_date is null and upper(btrim(r.device_number)) = v_number)
  then raise exception 'RENTAL_NUMBER_ALREADY_ACTIVE' using errcode = '23505'; end if;

  if p_catalog_id is not null then
    select * into v_catalog from public.device_catalog c where c.id = p_catalog_id;
    if not found then raise exception 'DEVICE_TYPE_NOT_FOUND' using errcode = '23503'; end if;
  elsif v_type <> '' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qtool-device-type:' || lower(v_type), 0));
    select * into v_catalog from public.device_catalog c
      where lower(btrim(c.geraetetyp)) = lower(v_type)
      order by (c.catalog_status = 'approved') desc, c.created_at asc limit 1;
    if not found then
      insert into public.device_catalog (
        geraetetyp, hersteller, modell, catalog_status, created_by
      ) values (
        v_type, 'Noch offen', 'Vor Ort erfasst', 'provisional', v_uid
      ) returning * into v_catalog;
    end if;
  else
    raise exception 'DEVICE_TYPE_REQUIRED' using errcode = '22023';
  end if;

  insert into public.rental_devices (
    report_id, device_type, device_number, start_date, catalog_id,
    apartment, room, counter_start, runtime_hours, created_by
  ) values (
    p_report_id, v_catalog.geraetetyp, v_number, coalesce(p_start_date, current_date), v_catalog.id,
    nullif(btrim(coalesce(p_apartment, '')), ''), nullif(btrim(coalesce(p_room, '')), ''),
    nullif(btrim(coalesce(p_counter_start, '')), ''), nullif(btrim(coalesce(p_runtime_hours, '')), ''), v_uid
  ) returning id into v_rental_id;
  return query select v_rental_id, v_catalog.id, v_catalog.geraetetyp, v_catalog.catalog_status;
end
$function$;

revoke all on function public.create_rental_device_assignment(text,text,uuid,text,date,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_rental_device_assignment(text,text,uuid,text,date,text,text,text,text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
