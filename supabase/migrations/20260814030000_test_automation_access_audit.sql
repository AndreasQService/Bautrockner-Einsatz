-- TEST-ONLY infrastructure for short-lived browser automation access.
-- The migration fails closed if accidentally executed outside the known test project.
do $$
begin
  if current_setting('app.settings.supabase_project_ref', true) is distinct from 'aoxduqspiezzyqeqyzzl' then
    raise exception 'TEST GUARD: automation access migration is restricted to aoxduqspiezzyqeqyzzl';
  end if;
end $$;

create table if not exists public.qtool_automation_nonces (
  nonce text primary key,
  issued_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  key_id text not null,
  request_id uuid not null unique,
  constraint automation_nonce_length check (length(nonce) between 32 and 128),
  constraint automation_nonce_fresh check (issued_at > now() - interval '10 minutes')
);

create table if not exists public.qtool_automation_audit (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event text not null check (event in ('issued', 'rejected', 'failed', 'revoked')),
  request_id uuid not null,
  key_id text not null,
  host text not null,
  detail text
);

alter table public.qtool_automation_nonces enable row level security;
alter table public.qtool_automation_audit enable row level security;

-- Deliberately no anon/authenticated policies. Only the server-side service role may access these tables.
revoke all on public.qtool_automation_nonces from anon, authenticated;
revoke all on public.qtool_automation_audit from anon, authenticated;

create index if not exists qtool_automation_audit_created_at_idx
  on public.qtool_automation_audit (created_at desc);
