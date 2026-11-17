-- Foundations: helper schema, enums, profiles and roles, audit log, rate limiting.
-- Convention: every function sets search_path = '' and uses fully qualified names.

create schema if not exists private;
comment on schema private is 'Internal helpers. Not exposed through the API.';
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create type public.app_role as enum ('admin', 'editor');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 80),
  role          public.app_role,            -- null means signed in but no admin access
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.profiles.role is 'null = no access. Changed only through public.set_user_role().';

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- A new sign-in gets a profile with no role. Access is granted separately by an admin.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Role checks used by every policy. SECURITY DEFINER so policies on other
-- tables can read profiles without opening profiles up to everyone.
create function private.has_role(variadic p_roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = any (p_roles)
  )
$$;

create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('admin', 'editor')
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('admin')
$$;

revoke all on function private.has_role(public.app_role[]), private.is_staff(), private.is_admin() from public;
grant execute on function private.has_role(public.app_role[]), private.is_staff(), private.is_admin()
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------- audit log
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

create function private.audit(p_action text, p_entity text, p_entity_id text, p_meta jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'::jsonb))
$$;
revoke all on function private.audit(text, text, text, jsonb) from public;

-- Only an admin can change a role, and never their own (prevents lock-out and self-promotion).
create function public.set_user_role(p_user_id uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Only an admin can change roles' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'No such user' using errcode = 'P0002';
  end if;
  perform private.audit('role.set', 'profile', p_user_id::text, jsonb_build_object('role', p_role));
end $$;
revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;

-- ---------------------------------------------------------------- rate limiting
create table private.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 1,
  primary key (key, window_start)
);

-- Fixed-window limiter keyed by the signed-in user. Returns true while under the limit.
create function public.hit_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_window timestamptz;
  v_hits integer;
begin
  if v_uid is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_bucket !~ '^[a-z0-9_.-]{1,40}$' or p_max < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit arguments' using errcode = '22023';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into private.rate_limits as r (key, window_start)
  values (p_bucket || ':' || v_uid::text, v_window)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  delete from private.rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_max;
end $$;
revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.hit_rate_limit(text, integer, integer) to authenticated;
