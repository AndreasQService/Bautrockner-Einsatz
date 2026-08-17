-- Migration: 20260816030000_authenticated_rls_policies.sql
-- Hardens RLS on damage_reports: Requires authenticated role (auth.role() = 'authenticated').
-- Revokes write access from unauthenticated 'anon' role to enforce strict tenant security boundaries.

DROP POLICY IF EXISTS damage_reports_write_policy ON public.damage_reports;
DROP POLICY IF EXISTS damage_reports_insert_policy ON public.damage_reports;
DROP POLICY IF EXISTS damage_reports_update_policy ON public.damage_reports;
DROP POLICY IF EXISTS damage_reports_authenticated_write_policy ON public.damage_reports;

CREATE POLICY damage_reports_authenticated_write_policy ON public.damage_reports
  FOR ALL TO authenticated
  USING (
    auth.role() = 'authenticated'
  )
  WITH CHECK (
    auth.role() = 'authenticated'
  );

-- Revoke write permissions from unauthenticated anon role
REVOKE INSERT, UPDATE, DELETE ON public.damage_reports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.damage_reports TO authenticated, service_role;
