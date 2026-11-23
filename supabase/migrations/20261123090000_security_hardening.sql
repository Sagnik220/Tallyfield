-- Security pass.
-- 1) Page views: one visitor can add at most 3 views per page per day (stops count inflation by repeated
--    requests), and only real pages are recorded: '/', '/archive', '/about' and published posts.
alter table private.page_visitors_daily add column if not exists hits integer not null default 1;

create or replace function public.track_page_view(p_path text, p_referrer_host text, p_country text, p_device text, p_visitor_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Asia/Kolkata')::date;
  v_post uuid;
  v_hits integer;
  v_new integer := 0;
begin
  if p_path is null or char_length(p_path) > 300 or p_path !~ '^/[A-Za-z0-9/_-]*$' then return; end if;
  if p_path like '/posts/%' then
    select id into v_post from public.posts where slug = substring(p_path from 8) and status = 'published';
    if v_post is null then return; end if;
  elsif p_path not in ('/', '/archive', '/about') then
    return;
  end if;
  insert into private.page_visitors_daily as v (day, path, visitor_hash) values (v_day, p_path, left(p_visitor_hash, 64))
    on conflict (day, path, visitor_hash) do update set hits = v.hits + 1
    returning v.hits into v_hits;
  if v_hits > 3 then return; end if;
  if v_hits = 1 then v_new := 1; end if;
  insert into public.page_views_daily as d (day, path, post_id, referrer_host, country, device, views, visitors)
  values (v_day, p_path, v_post, left(coalesce(p_referrer_host, ''), 120), left(coalesce(p_country, ''), 2),
          case when p_device in ('mobile', 'tablet') then p_device else 'desktop' end, 1, v_new)
  on conflict (day, path, referrer_host, country, device)
    do update set views = d.views + 1, visitors = d.visitors + excluded.visitors, post_id = coalesce(d.post_id, excluded.post_id);
  delete from private.page_visitors_daily where day < v_day - 2;
end $$;
revoke all on function public.track_page_view(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.track_page_view(text, text, text, text, text) to service_role;

-- Junk rows from paths that are not pages (including the security test).
delete from public.page_views_daily
 where not (path in ('/', '/archive', '/about') or path like '/posts/%');

-- 2) Least privilege: drop write grants that row level security already blocks, so a future policy
--    mistake cannot open them. Reads stay as they are.
revoke insert, update, delete on public.page_views_daily from anon, authenticated;
revoke insert, update, delete on public.stories from anon;
revoke insert, update, delete on public.audit_log, public.post_revisions, public.integration_tokens from anon, authenticated;
