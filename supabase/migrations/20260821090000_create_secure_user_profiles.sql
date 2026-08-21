begin;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  role text not null check (role in ('admin', 'technician', 'handwerker', 'user')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
revoke all on table public.user_profiles from public, anon, authenticated;
grant all on table public.user_profiles to service_role;

insert into public.user_profiles (id, display_name, role, is_active)
select
  u.id,
  'Andreas Strehler',
  'admin',
  true
from auth.users u
where u.deleted_at is null
  and lower(coalesce(u.email, '')) = 'a.strehler@q-service.ch'
on conflict (id) do update
set
  display_name = 'Andreas Strehler',
  role = 'admin',
  is_active = true,
  updated_at = now();

commit;
