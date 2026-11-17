-- Minimal stand-in for the parts of Supabase the migrations rely on, so they can be
-- tested on plain Postgres (CI service container or a local server). Never run this on Supabase itself.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
grant usage on schema public, auth, extensions, storage to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;

-- Test helpers: switch identity inside a transaction.
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;
create or replace function tests.as_anon() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true), set_config('role', 'anon', true);
$$;
create or replace function tests.as_user(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_id::text, true), set_config('role', 'authenticated', true);
$$;
create or replace function tests.as_owner() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', true), set_config('role', 'none', true);
$$;
grant execute on all functions in schema tests to anon, authenticated;
