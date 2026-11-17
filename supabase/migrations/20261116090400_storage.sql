-- Image storage. One public bucket: files are served by URL, but only staff can add, change or remove them.
-- File names are random UUIDs, so an unpublished image is not discoverable by guessing.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy media_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select private.is_staff()));
create policy media_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select private.is_staff()))
  with check (bucket_id = 'media' and (select private.is_staff()));
create policy media_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select private.is_staff()));
