-- Cookie-free site analytics. Only daily totals are kept: no IP addresses, no cookies, no per-person history.
-- A visitor is counted once per page per day using a hash of (day, salt, IP, browser) that changes every day.
create table public.page_views_daily (
  day           date not null,
  path          text not null check (char_length(path) <= 300),
  post_id       uuid references public.posts (id) on delete cascade,
  referrer_host text not null default '' check (char_length(referrer_host) <= 120),
  country       text not null default '' check (char_length(country) <= 2),
  device        text not null default 'desktop' check (device in ('mobile', 'tablet', 'desktop')),
  views         integer not null default 0,
  visitors      integer not null default 0,
  primary key (day, path, referrer_host, country, device)
);
create index page_views_daily_post_idx on public.page_views_daily (post_id, day);

create table private.page_visitors_daily (
  day           date not null,
  path          text not null,
  visitor_hash  text not null,
  primary key (day, path, visitor_hash)
);

alter table public.page_views_daily enable row level security;
alter table private.page_visitors_daily enable row level security;
grant select on public.page_views_daily to authenticated;
create policy page_views_read_staff on public.page_views_daily for select to authenticated using ((select private.is_staff()));

-- Called by the site's /api/track route with the secret key only. Records one page view.
create function public.track_page_view(p_path text, p_referrer_host text, p_country text, p_device text, p_visitor_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
  v_post uuid;
  v_new integer := 0;
begin
  if p_path !~ '^/[A-Za-z0-9/_-]{0,299}$' then return; end if;
  if p_path like '/posts/%' then
    select id into v_post from public.posts where slug = substring(p_path from 8) and status = 'published';
  end if;
  insert into private.page_visitors_daily (day, path, visitor_hash) values (v_day, p_path, left(p_visitor_hash, 64))
    on conflict do nothing;
  get diagnostics v_new = row_count;
  insert into public.page_views_daily as d (day, path, post_id, referrer_host, country, device, views, visitors)
  values (v_day, p_path, v_post, left(coalesce(p_referrer_host, ''), 120), left(coalesce(p_country, ''), 2),
          case when p_device in ('mobile', 'tablet') then p_device else 'desktop' end, 1, v_new)
  on conflict (day, path, referrer_host, country, device)
    do update set views = d.views + 1, visitors = d.visitors + excluded.visitors, post_id = coalesce(d.post_id, excluded.post_id);
  delete from private.page_visitors_daily where day < v_day - 2;
end $$;
revoke all on function public.track_page_view(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.track_page_view(text, text, text, text, text) to service_role;
