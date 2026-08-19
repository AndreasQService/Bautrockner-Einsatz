begin;

-- The RPC is not used by the fail-closed client anymore. Keep the database
-- object for compatibility, but remove every browser-callable privilege.
revoke all on function public.renew_project_lock(text,text)
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
