with imgs as (
  select
    img->>'id' as id,
    regexp_replace(img->>'name', '[\\/:*?"<>|]', '_', 'g') as filename,
    case img->>'assignedTo'
      when 'Küche' then 'Kueche'
      when 'Bad' then 'Bad'
      when 'Wohnzimmer' then 'Wohnzimmer'
      else 'Sonstiges'
    end as room_name,
    img->>'supabasePath' as storage_path,
    coalesce((o.metadata->>'size')::bigint, 0) as size_bytes,
    coalesce(o.metadata->>'mimetype', 'image/jpeg') as mime_type
  from public.damage_reports d
  cross join lateral jsonb_array_elements(d.report_data->'images') img
  join storage.objects o
    on o.bucket_id = 'case-files'
   and o.name = img->>'supabasePath'
  where d.id = 'P-1786343434847'
    and coalesce(img->>'supabasePath', '') <> ''
), queued as (
  select i.id, q.*
  from imgs i
  cross join lateral public.enqueue_project_image_upload(
    'P-1786343434847',
    i.id,
    i.filename,
    i.mime_type,
    i.size_bytes,
    'BACKFILL_VERIFIED_STORAGE',
    'case-files',
    i.storage_path,
    'QTool/20260411_Rychenbergstrasse_34_Winterthur/Fotos/' || i.room_name || '/' || i.filename
  ) q
)
select count(*) as queued_count from queued;
