-- Content model: categories, tags, media, posts and their links, revisions, products and prices.

create type public.post_status as enum ('draft', 'published', 'archived');
create type public.post_kind   as enum ('gallery', 'article');
create type public.media_source as enum ('upload', 'instagram');

create domain public.slug as text
  check (value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(value) between 1 and 120);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        public.slug not null unique,
  name        text not null check (char_length(name) between 1 and 60),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  slug        public.slug not null unique,
  name        text not null check (char_length(name) between 1 and 60),
  created_at  timestamptz not null default now()
);

create table public.media (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null unique check (storage_path !~ '(^/|\.\.)'),
  alt           text not null default '' check (char_length(alt) <= 300),
  width         integer check (width > 0),
  height        integer check (height > 0),
  mime_type     text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  source        public.media_source not null default 'upload',
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.posts (
  id                 uuid primary key default gen_random_uuid(),
  slug               public.slug not null unique,
  title              text not null check (char_length(title) between 1 and 160),
  deck               text not null default '' check (char_length(deck) <= 300),
  kind               public.post_kind not null default 'article',
  status             public.post_status not null default 'draft',
  category_id        uuid not null references public.categories (id) on delete restrict,
  cover_media_id     uuid references public.media (id) on delete set null,
  -- Versioned block document: {"version": 1, "blocks": [...]}. Shape is validated in the app (src/blocks).
  body               jsonb not null default '{"version": 1, "blocks": []}'::jsonb
                     check (jsonb_typeof(body) = 'object' and jsonb_typeof(body -> 'blocks') = 'array'),
  source_url         text check (source_url is null or source_url ~ '^https://'),
  prices_checked_on  date,
  price_sources      text not null default '' check (char_length(price_sources) <= 300),
  seo                jsonb not null default '{}'::jsonb check (jsonb_typeof(seo) = 'object'),
  author_id          uuid references auth.users (id) on delete set null,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  search             tsvector generated always as (
                       setweight(to_tsvector('english', title), 'A') ||
                       setweight(to_tsvector('english', deck), 'B')
                     ) stored,
  constraint published_needs_date check (status <> 'published' or published_at is not null)
);
create index posts_listing_idx  on public.posts (status, published_at desc);
create index posts_category_idx on public.posts (category_id);
create index posts_search_idx   on public.posts using gin (search);

create function private.posts_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;
create trigger posts_before_write before insert or update on public.posts
  for each row execute function private.posts_before_write();

create table public.post_tags (
  post_id  uuid not null references public.posts (id) on delete cascade,
  tag_id   uuid not null references public.tags (id) on delete cascade,
  primary key (post_id, tag_id)
);
create index post_tags_tag_idx on public.post_tags (tag_id);

-- Ordered slides of a gallery post (and the images attached to an article).
create table public.post_media (
  post_id   uuid not null references public.posts (id) on delete cascade,
  media_id  uuid not null references public.media (id) on delete cascade,
  position  integer not null check (position >= 0),
  primary key (post_id, media_id),
  unique (post_id, position)
);

-- Where a post was imported from. provider is free text so new importers need no migration.
create table public.social_sources (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid references public.posts (id) on delete cascade,
  provider     text not null check (provider ~ '^[a-z][a-z0-9_]{1,30}$'),
  external_id  text not null,
  permalink    text not null check (permalink ~ '^https://'),
  caption      text not null default '',
  raw          jsonb not null default '{}'::jsonb,
  fetched_at   timestamptz not null default now(),
  unique (provider, external_id)
);
create index social_sources_post_idx on public.social_sources (post_id);

-- Every edit keeps the previous version.
create table public.post_revisions (
  id          bigint generated always as identity primary key,
  post_id     uuid not null references public.posts (id) on delete cascade,
  snapshot    jsonb not null,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index post_revisions_post_idx on public.post_revisions (post_id, created_at desc);

create function private.posts_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.audit('post.create', 'post', new.id::text, jsonb_build_object('slug', new.slug));
  elsif tg_op = 'UPDATE' then
    if (old.title, old.deck, old.body, old.kind, old.category_id)
       is distinct from (new.title, new.deck, new.body, new.kind, new.category_id) then
      insert into public.post_revisions (post_id, snapshot, created_by)
      values (old.id,
              jsonb_build_object('title', old.title, 'deck', old.deck, 'body', old.body,
                                 'kind', old.kind, 'category_id', old.category_id, 'status', old.status),
              (select auth.uid()));
    end if;
    if old.status is distinct from new.status then
      perform private.audit('post.status', 'post', new.id::text,
                            jsonb_build_object('from', old.status, 'to', new.status));
    end if;
  elsif tg_op = 'DELETE' then
    perform private.audit('post.delete', 'post', old.id::text, jsonb_build_object('slug', old.slug));
  end if;
  return null;
end $$;
create trigger posts_after_write after insert or update or delete on public.posts
  for each row execute function private.posts_after_write();

-- Products and India prices: the data behind value tables, kept separate so it can be reused and tracked over time.
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        public.slug not null unique,
  brand       text not null check (char_length(brand) between 1 and 60),
  model       text not null check (char_length(model) between 1 and 120),
  reference   text not null default '',
  created_at  timestamptz not null default now()
);

create table public.price_points (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  price_inr   integer not null check (price_inr > 0),
  retailer    text not null check (char_length(retailer) between 1 and 120),
  checked_on  date not null,
  note        text not null default '',
  created_at  timestamptz not null default now()
);
create index price_points_product_idx on public.price_points (product_id, checked_on desc);

create table public.post_products (
  post_id     uuid not null references public.posts (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  position    integer not null default 0,
  primary key (post_id, product_id)
);

-- Feature flags and site-wide settings.
create table public.site_settings (
  key         text primary key check (key ~ '^[a-z][a-z0-9_.]{1,60}$'),
  value       jsonb not null,
  is_public   boolean not null default false,
  updated_at  timestamptz not null default now()
);
create trigger site_settings_touch before update on public.site_settings
  for each row execute function private.touch_updated_at();

-- Third-party access tokens (for example the Instagram token). Server only: see the security migration.
create table public.integration_tokens (
  provider      text primary key check (provider ~ '^[a-z][a-z0-9_]{1,30}$'),
  access_token  text not null,
  expires_at    timestamptz,
  updated_at    timestamptz not null default now()
);
create trigger integration_tokens_touch before update on public.integration_tokens
  for each row execute function private.touch_updated_at();
