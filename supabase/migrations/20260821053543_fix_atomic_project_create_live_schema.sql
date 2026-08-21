begin;

create or replace function public.create_project_and_acquire_lock(
  p_project_id text,
  p_report_data jsonb,
  p_session_token text,
  p_device text,
  p_client_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_acquired boolean;
begin
  if v_uid is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if p_project_id is null or length(p_project_id) not between 3 and 100
     or p_session_token is null or length(p_session_token) < 20
     or pg_catalog.jsonb_typeof(p_report_data) <> 'object' then
    raise exception 'INVALID_PROJECT_PAYLOAD' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('qtool-session:' || p_session_token, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_project_id, 0)
  );

  if exists (select 1 from public.damage_reports where id = p_project_id) then
    if exists (
      select 1
      from public.project_sessions
      where open_project_id = p_project_id
        and session_token = p_session_token
        and owner_user_id = v_uid
    ) then
      return pg_catalog.jsonb_build_object(
        'created', true,
        'already_existed', true,
        'project_id', p_project_id
      );
    end if;
    raise exception 'PROJECT_ALREADY_EXISTS' using errcode = '23505';
  end if;

  insert into public.damage_reports
    (id, project_title, client, address, status, assigned_to, report_data)
  values
    (
      p_project_id,
      p_report_data->>'projectTitle',
      p_report_data->>'client',
      coalesce(p_report_data->>'address', p_report_data->>'street'),
      coalesce(nullif(p_report_data->>'status', ''), 'Schadenaufnahme'),
      p_report_data->>'assignedTo',
      p_report_data
    );

  select acquired
  into v_acquired
  from public.acquire_project_lock(
    p_project_id,
    p_session_token,
    v_uid::text,
    coalesce(auth.jwt()->>'email', v_uid::text),
    p_device,
    p_client_id
  );

  if v_acquired is distinct from true then
    raise exception 'LOCK_OWNERSHIP_NOT_CONFIRMED' using errcode = '42501';
  end if;

  return pg_catalog.jsonb_build_object(
    'created', true,
    'already_existed', false,
    'project_id', p_project_id
  );
end
$function$;

revoke all on function public.create_project_and_acquire_lock(text,jsonb,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_project_and_acquire_lock(text,jsonb,text,text,text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
