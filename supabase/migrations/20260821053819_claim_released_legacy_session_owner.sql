begin;

create or replace function public.acquire_project_lock(
  p_project_id text,
  p_session_token text,
  p_user_id text,
  p_user_name text,
  p_device text,
  p_client_id text default null
)
returns table(
  acquired boolean,
  lock_owner text,
  locked_at timestamptz,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_owner public.project_sessions%rowtype;
  v_request_session public.project_sessions%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('qtool-session:' || p_session_token, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_project_id, 0)
  );

  select *
  into v_request_session
  from public.project_sessions
  where session_token = p_session_token
  for update;

  -- A pre-ownership session may be claimed only when it owns no project.
  -- This preserves old browsers without permitting takeover of any lock.
  if found
     and v_request_session.owner_user_id is null
     and v_request_session.open_project_id is null then
    update public.project_sessions
    set owner_user_id = v_uid,
        client_id = coalesce(p_client_id, client_id),
        last_seen = pg_catalog.now()
    where session_token = p_session_token
      and owner_user_id is null
      and open_project_id is null;

    select *
    into v_request_session
    from public.project_sessions
    where session_token = p_session_token
    for update;
  end if;

  if found and v_request_session.owner_user_id is distinct from v_uid then
    raise exception 'SESSION_OWNER_MISMATCH' using errcode = '42501';
  end if;
  if found
     and v_request_session.open_project_id is not null
     and v_request_session.open_project_id is distinct from p_project_id then
    raise exception 'SESSION_ALREADY_OWNS_PROJECT' using errcode = '55000';
  end if;

  select *
  into v_owner
  from public.project_sessions
  where open_project_id = p_project_id
  limit 1
  for update;

  if found
     and (v_owner.session_token <> p_session_token or v_owner.owner_user_id <> v_uid) then
    return query
    select false,
      coalesce(nullif(pg_catalog.split_part(v_owner.device, ':', 3), ''), 'Unbekannt'),
      v_owner.created_at,
      v_owner.last_seen;
    return;
  end if;

  insert into public.project_sessions
    (session_token, open_project_id, mode, device, last_seen, created_at, owner_user_id, client_id)
  values
    (
      p_session_token,
      p_project_id,
      case when pg_catalog.split_part(coalesce(p_device, ''), ':', 1) = 'iPad'
           then 'technician' else 'desktop' end,
      p_device,
      pg_catalog.now(),
      pg_catalog.now(),
      v_uid,
      p_client_id
    )
  on conflict (session_token) do update set
    open_project_id = excluded.open_project_id,
    mode = excluded.mode,
    device = excluded.device,
    last_seen = pg_catalog.now(),
    owner_user_id = excluded.owner_user_id,
    client_id = excluded.client_id,
    created_at = case
      when project_sessions.open_project_id is distinct from excluded.open_project_id
      then pg_catalog.now()
      else project_sessions.created_at
    end
  where project_sessions.owner_user_id = v_uid;

  if not exists (
    select 1
    from public.project_sessions
    where session_token = p_session_token
      and open_project_id = p_project_id
      and owner_user_id = v_uid
  ) then
    raise exception 'LOCK_OWNERSHIP_NOT_CONFIRMED' using errcode = '42501';
  end if;

  return query
  select true,
    coalesce(nullif(p_user_name, ''), v_uid::text),
    pg_catalog.now(),
    pg_catalog.now();
end
$function$;

revoke all on function public.acquire_project_lock(text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.acquire_project_lock(text,text,text,text,text,text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
