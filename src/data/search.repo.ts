import type { Db } from '@/lib/supabase/server'
import type { PostSummary, SearchParams } from '@/domain/post'
import { raise } from './errors'
import type { SearchRow } from './types'

export const PAGE_SIZE = 24

/** Calls the search_posts database function. The function itself only ever returns published posts. */
export async function searchPosts(db: Db, params: SearchParams): Promise<PostSummary[]> {
  const { data, error } = await db.rpc('search_posts', {
    p_query: params.q,
    p_category: params.category ?? null,
    p_tags: params.tags,
    p_limit: PAGE_SIZE,
    p_offset: (params.page - 1) * PAGE_SIZE,
  })
  if (error) raise(error, 'searchPosts')
  return ((data ?? []) as SearchRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    deck: row.deck,
    kind: row.kind,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    coverPath: row.cover_path,
    coverAlt: row.cover_alt,
    tags: row.tags,
    publishedAt: row.published_at,
  }))
}
