-- Instagram-style Stories: full-screen vertical image/video slides shown in a row on the homepage.
create table public.stories (
  id          uuid primary key default gen_random_uuid(),
  media_id    uuid not null references public.media (id) on delete cascade,
  caption     text not null default '' check (char_length(caption) <= 200),
  link_url    text check (link_url is null or link_url ~ '^(https://|/(?!/))'),
  link_label  text not null default '' check (char_length(link_label) <= 40),
  duration_ms integer not null default 6000 check (duration_ms between 2000 and 60000),
  position    integer not null default 0,
  status      public.post_status not null default 'draft',
  expires_at  timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index stories_live_idx on public.stories (status, position);
create trigger stories_touch before update on public.stories
  for each row execute function private.touch_updated_at();

alter table public.stories enable row level security;
grant select on public.stories to anon, authenticated;
grant insert, update, delete on public.stories to authenticated;

create policy stories_read_live on public.stories for select to anon, authenticated
  using (status = 'published' and (expires_at is null or expires_at > now()));
create policy stories_read_staff on public.stories for select to authenticated using ((select private.is_staff()));
create policy stories_insert on public.stories for insert to authenticated
  with check ((select private.is_staff()) and created_by = (select auth.uid()));
create policy stories_update on public.stories for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy stories_delete on public.stories for delete to authenticated using ((select private.is_staff()));

-- Visitors may see a media row when a live story uses it (as well as when a readable post does).
drop policy media_read_public on public.media;
create policy media_read_public on public.media for select to anon, authenticated
  using (
    exists (select 1 from public.posts p where p.cover_media_id = media.id)
    or exists (select 1 from public.post_media pm where pm.media_id = media.id)
    or exists (select 1 from public.stories s where s.media_id = media.id)
  );
