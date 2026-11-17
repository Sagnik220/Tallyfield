-- Access rules. Two layers:
--   1. Table privileges: what each API role may attempt at all.
--   2. Row level security: which rows that attempt may touch.
-- Default is deny. Nothing is reachable unless it is granted here.

-- ---------------------------------------------------------------- privileges
revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

grant select on public.categories, public.tags, public.posts, public.post_tags, public.post_media,
                public.media, public.products, public.price_points, public.post_products,
                public.site_settings
  to anon, authenticated;

grant insert, update, delete on public.categories, public.tags, public.posts, public.post_tags,
                public.post_media, public.media, public.products, public.price_points,
                public.post_products, public.site_settings, public.social_sources
  to authenticated;

grant select on public.social_sources, public.post_revisions, public.audit_log, public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
-- integration_tokens: no grants. Only the service role (server-side) can read it.

alter table public.profiles            enable row level security;
alter table public.audit_log           enable row level security;
alter table public.categories          enable row level security;
alter table public.tags                enable row level security;
alter table public.media               enable row level security;
alter table public.posts               enable row level security;
alter table public.post_tags           enable row level security;
alter table public.post_media          enable row level security;
alter table public.social_sources      enable row level security;
alter table public.post_revisions      enable row level security;
alter table public.products            enable row level security;
alter table public.price_points        enable row level security;
alter table public.post_products       enable row level security;
alter table public.site_settings       enable row level security;
alter table public.integration_tokens  enable row level security;
alter table private.rate_limits        enable row level security;

-- ---------------------------------------------------------------- profiles
create policy profiles_read_own_or_admin on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update_own_name on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------- audit log (append-only, admin read)
create policy audit_read_admin on public.audit_log for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------- posts
create policy posts_read_published on public.posts for select to anon, authenticated
  using (status = 'published' and published_at <= now());
create policy posts_read_staff on public.posts for select to authenticated
  using ((select private.is_staff()));
create policy posts_insert_staff on public.posts for insert to authenticated
  with check ((select private.is_staff()) and author_id = (select auth.uid()));
create policy posts_update_staff on public.posts for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy posts_delete_admin on public.posts for delete to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------- reference data: public read, staff write, admin delete
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy categories_insert on public.categories for insert to authenticated with check ((select private.is_staff()));
create policy categories_update on public.categories for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy categories_delete on public.categories for delete to authenticated using ((select private.is_admin()));

create policy tags_read on public.tags for select to anon, authenticated using (true);
create policy tags_insert on public.tags for insert to authenticated with check ((select private.is_staff()));
create policy tags_update on public.tags for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy tags_delete on public.tags for delete to authenticated using ((select private.is_admin()));

create policy products_read on public.products for select to anon, authenticated using (true);
create policy products_insert on public.products for insert to authenticated with check ((select private.is_staff()));
create policy products_update on public.products for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy products_delete on public.products for delete to authenticated using ((select private.is_admin()));

create policy prices_read on public.price_points for select to anon, authenticated using (true);
create policy prices_insert on public.price_points for insert to authenticated with check ((select private.is_staff()));
create policy prices_update on public.price_points for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy prices_delete on public.price_points for delete to authenticated using ((select private.is_staff()));

-- ---------------------------------------------------------------- link tables
-- Readable when the parent post is readable: the sub-select on posts is itself filtered by the posts policies.
create policy post_tags_read on public.post_tags for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_tags_insert on public.post_tags for insert to authenticated with check ((select private.is_staff()));
create policy post_tags_delete on public.post_tags for delete to authenticated using ((select private.is_staff()));

create policy post_media_read on public.post_media for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_media_insert on public.post_media for insert to authenticated with check ((select private.is_staff()));
create policy post_media_update on public.post_media for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy post_media_delete on public.post_media for delete to authenticated using ((select private.is_staff()));

create policy post_products_read on public.post_products for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_products_insert on public.post_products for insert to authenticated with check ((select private.is_staff()));
create policy post_products_update on public.post_products for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy post_products_delete on public.post_products for delete to authenticated using ((select private.is_staff()));

-- ---------------------------------------------------------------- media
-- Public can see a media row only when a readable post uses it.
create policy media_read_public on public.media for select to anon, authenticated
  using (
    exists (select 1 from public.posts p where p.cover_media_id = media.id)
    or exists (select 1 from public.post_media pm where pm.media_id = media.id)
  );
create policy media_read_staff on public.media for select to authenticated using ((select private.is_staff()));
create policy media_insert on public.media for insert to authenticated
  with check ((select private.is_staff()) and created_by = (select auth.uid()));
create policy media_update on public.media for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy media_delete on public.media for delete to authenticated using ((select private.is_staff()));

-- ---------------------------------------------------------------- staff-only tables
create policy social_sources_read on public.social_sources for select to authenticated using ((select private.is_staff()));
create policy social_sources_insert on public.social_sources for insert to authenticated with check ((select private.is_staff()));
create policy social_sources_update on public.social_sources for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy social_sources_delete on public.social_sources for delete to authenticated using ((select private.is_staff()));

create policy post_revisions_read on public.post_revisions for select to authenticated using ((select private.is_staff()));

-- ---------------------------------------------------------------- settings
create policy settings_read_public on public.site_settings for select to anon, authenticated using (is_public);
create policy settings_read_admin on public.site_settings for select to authenticated using ((select private.is_admin()));
create policy settings_insert on public.site_settings for insert to authenticated with check ((select private.is_admin()));
create policy settings_update on public.site_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy settings_delete on public.site_settings for delete to authenticated using ((select private.is_admin()));

-- integration_tokens and private.rate_limits: RLS on, no policies, no grants. Unreachable from the API roles.
