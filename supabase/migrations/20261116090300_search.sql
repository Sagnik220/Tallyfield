-- Public search: free text + category + tags, in one call.
-- SECURITY INVOKER, so the posts policies decide what the caller can find.

create extension if not exists pg_trgm with schema extensions;
create index posts_title_trgm_idx on public.posts using gin (title extensions.gin_trgm_ops);
create index tags_name_trgm_idx   on public.tags  using gin (name extensions.gin_trgm_ops);

create function public.search_posts(
  p_query     text default '',
  p_category  text default null,
  p_tags      text[] default '{}',
  p_limit     integer default 24,
  p_offset    integer default 0
)
returns table (
  id uuid, slug text, title text, deck text, kind public.post_kind,
  category_slug text, category_name text, cover_path text, cover_alt text,
  tags text[], published_at timestamptz, rank real
)
language sql stable security invoker set search_path = '' as $$
  with args as (
    select
      left(btrim(coalesce(p_query, '')), 100) as q,
      coalesce(p_tags, '{}')::text[]          as wanted,
      least(greatest(coalesce(p_limit, 24), 1), 50) as lim,
      greatest(coalesce(p_offset, 0), 0)      as off
  )
  select
    p.id, p.slug::text, p.title, p.deck, p.kind,
    c.slug::text, c.name, m.storage_path, m.alt,
    coalesce((select array_agg(t.slug::text order by t.name)
              from public.post_tags pt join public.tags t on t.id = pt.tag_id
              where pt.post_id = p.id), '{}') as tags,
    p.published_at,
    case when a.q = '' then 0
         else ts_rank(p.search, websearch_to_tsquery('english', a.q)) end as rank
  from args a
  cross join public.posts p
  join public.categories c on c.id = p.category_id
  left join public.media m on m.id = p.cover_media_id
  where p.status = 'published'
    and (p_category is null or c.slug = p_category)
    and (cardinality(a.wanted) = 0 or (
          select count(*) from public.post_tags pt join public.tags t on t.id = pt.tag_id
          where pt.post_id = p.id and t.slug = any (a.wanted)
        ) = cardinality(a.wanted))
    and (a.q = ''
         or p.search @@ websearch_to_tsquery('english', a.q)
         or p.title ilike '%' || replace(replace(replace(a.q, '\', '\\'), '%', '\%'), '_', '\_') || '%'
         or exists (select 1 from public.post_tags pt join public.tags t on t.id = pt.tag_id
                    where pt.post_id = p.id
                      and t.name ilike '%' || replace(replace(replace(a.q, '\', '\\'), '%', '\%'), '_', '\_') || '%'))
  order by rank desc, p.published_at desc
  limit (select lim from args) offset (select off from args)
$$;
revoke all on function public.search_posts(text, text, text[], integer, integer) from public;
grant execute on function public.search_posts(text, text, text[], integer, integer) to anon, authenticated;
