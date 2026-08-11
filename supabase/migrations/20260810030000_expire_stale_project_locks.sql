-- The lock RPC must be able to release an expired row even when that row was
-- created by another browser session and RLS hides it from the current caller.
-- The function itself only changes project_sessions and already enforces the
-- 20-minute active-lock window before replacing a lock.
alter function public.acquire_project_lock(text, text, text, text, text, text)
  security definer;

alter function public.acquire_project_lock(text, text, text, text, text, text)
  set search_path = public, pg_temp;

revoke all on function public.acquire_project_lock(text, text, text, text, text, text) from public;
grant execute on function public.acquire_project_lock(text, text, text, text, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
