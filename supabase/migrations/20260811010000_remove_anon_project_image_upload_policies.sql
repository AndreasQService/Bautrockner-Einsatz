drop policy if exists "Anon insert project_image_uploads" on public.project_image_uploads;
drop policy if exists "Anon update project_image_uploads" on public.project_image_uploads;
drop policy if exists "Anon select project_image_uploads" on public.project_image_uploads;

notify pgrst, 'reload schema';
