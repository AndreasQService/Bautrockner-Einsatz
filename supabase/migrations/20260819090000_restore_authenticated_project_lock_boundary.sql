-- Restorative security boundary for project creation and project-session locks.
-- Additive migration: do not edit or depend on test-only replacement bodies.

begin;

revoke all on table public.project_sessions from public, anon, authenticated;
revoke insert, update, delete, truncate on table public.damage_reports from public, anon;

do $policies$
declare policy_row record;
begin
  for policy_row in
    select policyname
      from pg_catalog.pg_policies
     where schemaname = 'public'
       and tablename = 'project_sessions'
       and ('anon' = any(roles) or 'public' = any(roles))
  loop
    execute format('drop policy if exists %I on public.project_sessions', policy_row.policyname);
  end loop;
end
$policies$;

drop policy if exists qtool_test_insert on public.damage_reports;
drop policy if exists qtool_test_update on public.damage_reports;
drop policy if exists qtool_test_delete on public.damage_reports;

create or replace function public.qtool_request_session_token()
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare v_headers jsonb; v_token text;
begin
  begin
    v_headers := nullif(pg_catalog.current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return null;
  end;
  v_token := nullif(coalesce(
    v_headers->>'x-qtool-session-token',
    pg_catalog.current_setting('request.jwt.claim.qtool_session_token', true)
  ), '');
  return v_token;
end
$function$;

create or replace function public.qtool_has_project_write_lock(p_project_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_project_id is not null
     and auth.uid() is not null
     and exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.is_active is true)
     and public.qtool_request_session_token() is not null
     and exists (
       select 1 from public.project_sessions s
        where s.open_project_id = p_project_id
          and s.session_token = public.qtool_request_session_token()
          and s.owner_user_id = auth.uid()
     )
$function$;

revoke all on function public.qtool_request_session_token() from public, anon, authenticated;
revoke all on function public.qtool_has_project_write_lock(text) from public, anon, authenticated;
grant execute on function public.qtool_request_session_token() to authenticated;
grant execute on function public.qtool_has_project_write_lock(text) to authenticated;

create or replace function public.qtool_room_has_project_write_lock(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_room_id is not null and exists (
    select 1
      from public.damage_report_rooms r
     where r.id = p_room_id
       and public.qtool_has_project_write_lock(r.report_id::text)
  )
$function$;
revoke all on function public.qtool_room_has_project_write_lock(uuid) from public, anon, authenticated;
grant execute on function public.qtool_room_has_project_write_lock(uuid) to authenticated;

-- Restore the project-owner write boundary across every project-scoped table.
-- New damage_reports rows remain RPC-only because no lock can safely pre-exist
-- the row; all other writes require the authenticated caller's exact lease.
do $owner_policies$
declare
  v_table text;
  v_project_column text;
  v_policy record;
begin
  for v_table, v_project_column in
    select * from (values
      ('damage_reports', 'id'),
      ('damage_report_rooms', 'report_id'),
      ('measurement_protocols', 'report_id'),
      ('rental_devices', 'report_id'),
      ('project_image_uploads', 'project_id'),
      ('project_tasks', 'project_id'),
      ('project_todos', 'project_id'),
      ('project_status_history', 'project_id'),
      ('case_documents', 'case_id'),
      ('case_extractions', 'case_id'),
      ('onedrive_project_folder_queue', 'project_id'),
      ('onedrive_sync_queue', 'project_id'),
      ('qtool_operations', 'report_id')
    ) as policy_map(table_name, project_column)
  loop
    if pg_catalog.to_regclass('public.' || v_table) is null then
      continue;
    end if;
    if not exists (
      select 1
        from information_schema.columns
       where table_schema = 'public'
         and table_name = v_table
         and column_name = v_project_column
    ) then
      raise exception 'QTOOL_POLICY_PROJECT_COLUMN_MISSING: %.%', v_table, v_project_column;
    end if;

    execute pg_catalog.format('alter table public.%I enable row level security', v_table);
    for v_policy in
      select policyname
        from pg_catalog.pg_policies
       where schemaname = 'public'
         and tablename = v_table
         and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    loop
      execute pg_catalog.format('drop policy if exists %I on public.%I', v_policy.policyname, v_table);
    end loop;

    execute pg_catalog.format(
      'revoke insert, update, delete, truncate, trigger on table public.%I from public, anon, authenticated',
      v_table
    );
    if v_table = 'damage_reports' then
      execute pg_catalog.format('grant select, update, delete on table public.%I to authenticated', v_table);
    else
      execute pg_catalog.format('grant select, insert, update, delete on table public.%I to authenticated', v_table);
      execute pg_catalog.format(
        'create policy qtool_owner_insert on public.%I for insert to authenticated with check (public.qtool_has_project_write_lock(%I::text))',
        v_table, v_project_column
      );
    end if;
    execute pg_catalog.format(
      'create policy qtool_owner_update on public.%I for update to authenticated using (public.qtool_has_project_write_lock(%I::text)) with check (public.qtool_has_project_write_lock(%I::text))',
      v_table, v_project_column, v_project_column
    );
    execute pg_catalog.format(
      'create policy qtool_owner_delete on public.%I for delete to authenticated using (public.qtool_has_project_write_lock(%I::text))',
      v_table, v_project_column
    );
  end loop;

  if pg_catalog.to_regclass('public.room_measurements') is not null then
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'room_measurements' and column_name = 'room_id'
    ) then
      raise exception 'QTOOL_POLICY_PROJECT_COLUMN_MISSING: room_measurements.room_id';
    end if;
    alter table public.room_measurements enable row level security;
    for v_policy in
      select policyname from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'room_measurements'
         and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    loop
      execute pg_catalog.format('drop policy if exists %I on public.room_measurements', v_policy.policyname);
    end loop;
    revoke insert, update, delete, truncate, trigger on table public.room_measurements from public, anon, authenticated;
    grant select, insert, update, delete on table public.room_measurements to authenticated;
    create policy qtool_owner_insert on public.room_measurements for insert to authenticated
      with check (public.qtool_room_has_project_write_lock(room_id));
    create policy qtool_owner_update on public.room_measurements for update to authenticated
      using (public.qtool_room_has_project_write_lock(room_id))
      with check (public.qtool_room_has_project_write_lock(room_id));
    create policy qtool_owner_delete on public.room_measurements for delete to authenticated
      using (public.qtool_room_has_project_write_lock(room_id));
  end if;
end
$owner_policies$;

-- The deployed test function uses the legacy OUT column names
-- (created_at, last_seen). PostgreSQL cannot change OUT row types with
-- CREATE OR REPLACE, so remove this exact, dependency-free signature first.
-- The surrounding migration transaction makes this fail closed.
revoke all on function public.acquire_project_lock(text,text,text,text,text,text)
  from public, anon, authenticated;
drop function public.acquire_project_lock(text,text,text,text,text,text);

create or replace function public.acquire_project_lock(
  p_project_id text,
  p_session_token text,
  p_user_id text,
  p_user_name text,
  p_device text,
  p_client_id text default null
)
returns table(acquired boolean, lock_owner text, locked_at timestamptz, last_seen_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_owner public.project_sessions%rowtype;
  v_request_session public.project_sessions%rowtype;
begin
  if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_profiles p where p.id = v_uid and p.is_active is true) then
    raise exception 'ACTIVE_USER_PROFILE_REQUIRED' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id <> v_uid::text then
    raise exception 'AUTHENTICATED_USER_MISMATCH' using errcode = '42501';
  end if;
  if p_project_id is null or p_session_token is null or length(p_session_token) < 20 then
    raise exception 'INVALID_LOCK_REQUEST' using errcode = '22023';
  end if;
  if not exists (select 1 from public.damage_reports where id = p_project_id) then
    raise exception 'UNKNOWN_PROJECT' using errcode = '23503';
  end if;

  -- Global order is session first, project second. This prevents one token
  -- racing itself onto two different projects under concurrent requests.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('qtool-session:' || p_session_token, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project_id, 0));
  select * into v_request_session from public.project_sessions
   where session_token = p_session_token for update;
  if found and v_request_session.owner_user_id <> v_uid then
    raise exception 'SESSION_OWNER_MISMATCH' using errcode = '42501';
  end if;
  if found and v_request_session.open_project_id is not null
     and v_request_session.open_project_id is distinct from p_project_id then
    raise exception 'SESSION_ALREADY_OWNS_PROJECT' using errcode = '55000';
  end if;
  select * into v_owner from public.project_sessions
   where open_project_id = p_project_id limit 1 for update;

  if found and (v_owner.session_token <> p_session_token or v_owner.owner_user_id <> v_uid) then
    return query select false,
      coalesce(nullif(pg_catalog.split_part(v_owner.device, ':', 3), ''), 'Unbekannt'),
      v_owner.created_at, v_owner.last_seen;
    return;
  end if;

  insert into public.project_sessions
    (session_token, open_project_id, mode, device, last_seen, created_at, owner_user_id, client_id)
  values
    (p_session_token, p_project_id,
     case when pg_catalog.split_part(coalesce(p_device, ''), ':', 1) = 'iPad' then 'technician' else 'desktop' end,
     p_device, pg_catalog.now(), pg_catalog.now(), v_uid, p_client_id)
  on conflict (session_token) do update set
    open_project_id = excluded.open_project_id,
    mode = excluded.mode,
    device = excluded.device,
    last_seen = pg_catalog.now(),
    owner_user_id = excluded.owner_user_id,
    client_id = excluded.client_id,
    created_at = case when project_sessions.open_project_id is distinct from excluded.open_project_id
                      then pg_catalog.now() else project_sessions.created_at end
  where project_sessions.owner_user_id = v_uid;

  if not exists (
    select 1 from public.project_sessions
     where session_token = p_session_token and open_project_id = p_project_id and owner_user_id = v_uid
  ) then raise exception 'LOCK_OWNERSHIP_NOT_CONFIRMED' using errcode = '42501'; end if;

  return query select true, coalesce(nullif(p_user_name, ''), v_uid::text), pg_catalog.now(), pg_catalog.now();
end
$function$;

create or replace function public.get_project_lock_status(p_project_id text, p_session_token text default null)
returns table(
  open_project_id text, mode text, device_type text, lock_owner text,
  locked_at timestamptz, last_seen_at timestamptz, is_owner boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_profiles p where p.id = v_uid and p.is_active is true) then
    raise exception 'ACTIVE_USER_PROFILE_REQUIRED' using errcode = '42501';
  end if;
  if p_project_id is null then raise exception 'INVALID_PROJECT_ID' using errcode = '22023'; end if;
  return query
    select s.open_project_id, s.mode, pg_catalog.split_part(coalesce(s.device, ''), ':', 1),
      coalesce(nullif(pg_catalog.split_part(s.device, ':', 3), ''), 'Unbekannt'),
      s.created_at, s.last_seen,
      (s.owner_user_id = v_uid and p_session_token is not null and s.session_token = p_session_token)
    from public.project_sessions s
    where s.open_project_id = p_project_id
    limit 1;
end
$function$;

create or replace function public.release_project_lock(p_project_id text, p_session_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_profiles p where p.id = v_uid and p.is_active is true) then
    raise exception 'ACTIVE_USER_PROFILE_REQUIRED' using errcode = '42501';
  end if;
  if p_project_id is null or p_session_token is null or length(p_session_token) < 20 then
    raise exception 'INVALID_LOCK_REQUEST' using errcode = '22023';
  end if;
  update public.project_sessions set open_project_id = null, last_seen = pg_catalog.now()
   where open_project_id = p_project_id and session_token = p_session_token and owner_user_id = v_uid;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'LOCK_OWNERSHIP_NOT_CONFIRMED' using errcode = '42501'; end if;
  return true;
end
$function$;

create or replace function public.create_project_and_acquire_lock(
  p_project_id text, p_report_data jsonb, p_session_token text,
  p_device text, p_client_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_uid uuid := auth.uid(); v_acquired boolean;
begin
  if v_uid is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_profiles p where p.id = v_uid and p.is_active is true) then
    raise exception 'ACTIVE_USER_PROFILE_REQUIRED' using errcode = '42501';
  end if;
  if p_project_id is null or length(p_project_id) not between 3 and 100
     or p_session_token is null or length(p_session_token) < 20
     or pg_catalog.jsonb_typeof(p_report_data) <> 'object' then
    raise exception 'INVALID_PROJECT_PAYLOAD' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('qtool-session:' || p_session_token, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project_id, 0));
  if exists (select 1 from public.damage_reports where id = p_project_id) then
    if exists (
      select 1 from public.project_sessions
       where open_project_id = p_project_id and session_token = p_session_token and owner_user_id = v_uid
    ) then
      return pg_catalog.jsonb_build_object('created', true, 'already_existed', true, 'project_id', p_project_id);
    end if;
    raise exception 'PROJECT_ALREADY_EXISTS' using errcode = '23505';
  end if;
  insert into public.damage_reports
    (id, project_title, client, address, status, assigned_to, assignee_name, report_data)
  values
    (p_project_id, p_report_data->>'projectTitle', p_report_data->>'client',
     coalesce(p_report_data->>'address', p_report_data->>'street'),
     coalesce(nullif(p_report_data->>'status', ''), 'Schadenaufnahme'),
     p_report_data->>'assignedTo', p_report_data->>'assigneeName', p_report_data);

  select acquired into v_acquired from public.acquire_project_lock(
    p_project_id, p_session_token, v_uid::text, coalesce(auth.jwt()->>'email', v_uid::text), p_device, p_client_id
  );
  if v_acquired is distinct from true then
    raise exception 'LOCK_OWNERSHIP_NOT_CONFIRMED' using errcode = '42501';
  end if;
  return pg_catalog.jsonb_build_object('created', true, 'already_existed', false, 'project_id', p_project_id);
end
$function$;

do $revoke_legacy_rpc_overloads$
declare v_proc regprocedure;
begin
  for v_proc in
    select p.oid::regprocedure
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'acquire_project_lock', 'get_project_lock_status',
         'release_project_lock', 'create_project_and_acquire_lock'
       )
  loop
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated', v_proc
    );
  end loop;
end
$revoke_legacy_rpc_overloads$;
grant execute on function public.acquire_project_lock(text,text,text,text,text,text) to authenticated;
grant execute on function public.get_project_lock_status(text,text) to authenticated;
grant execute on function public.release_project_lock(text,text) to authenticated;
grant execute on function public.create_project_and_acquire_lock(text,jsonb,text,text,text) to authenticated;

notify pgrst, 'reload schema';

commit;
