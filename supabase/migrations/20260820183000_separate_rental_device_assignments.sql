begin;

alter table public.device_catalog
    add column if not exists catalog_status text not null default 'approved',
    add column if not exists created_by uuid references auth.users(id),
    add column if not exists reviewed_at timestamptz,
    add column if not exists reviewed_by uuid references auth.users(id);

alter table public.device_catalog
    drop constraint if exists device_catalog_catalog_status_check;
alter table public.device_catalog
    add constraint device_catalog_catalog_status_check
    check (catalog_status in ('approved', 'provisional'));

alter table public.rental_devices
    add column if not exists catalog_id uuid references public.device_catalog(id),
    add column if not exists apartment text,
    add column if not exists room text,
    add column if not exists counter_start text,
    add column if not exists runtime_hours text,
    add column if not exists created_by uuid references auth.users(id);

create unique index if not exists rental_devices_active_number_uidx
    on public.rental_devices (upper(btrim(device_number)))
    where end_date is null and nullif(btrim(device_number), '') is not null;

drop policy if exists "Auth select device_catalog" on public.device_catalog;
create policy "Auth select device_catalog"
    on public.device_catalog for select to authenticated
    using (auth.uid() is not null);
grant select on public.device_catalog to authenticated;

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
    ) then
        raise exception 'AUTHENTICATED_ACTIVE_USER_REQUIRED' using errcode = '42501';
    end if;
    if nullif(btrim(coalesce(p_report_id, '')), '') is null or not public.qtool_has_project_write_lock(p_report_id) then
        raise exception 'PROJECT_WRITE_LOCK_REQUIRED' using errcode = '42501';
    end if;
    if v_number = '' then
        raise exception 'RENTAL_NUMBER_REQUIRED' using errcode = '22023';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qtool-rental:' || v_number, 0));

    if exists (
        select 1 from public.rental_devices r
        where r.end_date is null and upper(btrim(r.device_number)) = v_number
    ) then
        raise exception 'RENTAL_NUMBER_ALREADY_ACTIVE' using errcode = '23505';
    end if;

    if p_catalog_id is not null then
        select * into v_catalog from public.device_catalog c where c.id = p_catalog_id;
        if not found then raise exception 'DEVICE_TYPE_NOT_FOUND' using errcode = '23503'; end if;
    elsif v_type <> '' then
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('qtool-device-type:' || lower(v_type), 0));
        select * into v_catalog
        from public.device_catalog c
        where lower(btrim(c.geraetetyp)) = lower(v_type)
        order by (c.catalog_status = 'approved') desc, c.created_at asc
        limit 1;

        if not found then
            insert into public.device_catalog (
                geraetetyp, hersteller, modell, catalog_status, created_by,
                device_type, manufacturer, model_name, notes
            ) values (
                v_type, 'Noch offen', 'Vor Ort erfasst', 'provisional', v_uid,
                v_type, 'Noch offen', 'Vor Ort erfasst', 'Vorläufig auf Baustelle erfasst'
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
end;
$function$;

revoke all on function public.create_rental_device_assignment(text,text,uuid,text,date,text,text,text,text) from public, anon;
grant execute on function public.create_rental_device_assignment(text,text,uuid,text,date,text,text,text,text) to authenticated;

commit;
