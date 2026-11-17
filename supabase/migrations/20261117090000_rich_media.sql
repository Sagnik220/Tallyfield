-- Rich editor media: GIFs and short videos alongside images. Videos over 50 MB are embedded from YouTube/Instagram instead.
alter table public.media drop constraint if exists media_mime_type_check;
alter table public.media add constraint media_mime_type_check
  check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'));

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
where id = 'media';
