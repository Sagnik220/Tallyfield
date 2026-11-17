import type { Db } from '@/lib/supabase/server'
import type { Body } from '@/blocks'
import { raise } from './errors'
import type { MediaRow, PostRow } from './types'
import { getPublishedPostBySlug } from './posts.repo'

export interface CategoryRow {
  id: string
  slug: string
  name: string
}

export interface TagRow {
  slug: string
  name: string
}

export interface PublicArticle {
  post: PostRow
  category: CategoryRow | null
  tags: TagRow[]
  /** Every image the article uses, keyed by media id. */
  media: Record<string, MediaRow>
}

const MEDIA_COLUMNS = 'id, storage_path, alt, width, height, mime_type, source'

export async function listCategories(db: Db): Promise<CategoryRow[]> {
  const { data, error } = await db.from('categories').select('id, slug, name').order('sort_order')
  if (error) raise(error, 'listCategories')
  return (data ?? []) as CategoryRow[]
}

export async function listTags(db: Db): Promise<TagRow[]> {
  const { data, error } = await db.from('tags').select('slug, name').order('name')
  if (error) raise(error, 'listTags')
  return (data ?? []) as TagRow[]
}

export async function getMediaByIds(db: Db, ids: string[]): Promise<Record<string, MediaRow>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return {}
  const { data, error } = await db.from('media').select(MEDIA_COLUMNS).in('id', unique)
  if (error) raise(error, 'getMediaByIds')
  return Object.fromEntries(((data ?? []) as MediaRow[]).map((m) => [m.id, m]))
}

/** Media ids referenced anywhere in a post body: image, gallery and verdict blocks, and media inside rich text. */
export function mediaIdsInBody(body: Body): string[] {
  const ids: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; attrs?: { mediaId?: unknown }; content?: unknown[] }
    if (n.type === 'media' && typeof n.attrs?.mediaId === 'string') ids.push(n.attrs.mediaId)
    n.content?.forEach(walk)
  }
  for (const block of body.blocks) {
    const data = block.data as Record<string, unknown> | null
    if (!data) continue
    if (typeof data.mediaId === 'string') ids.push(data.mediaId)
    if (Array.isArray(data.mediaIds)) ids.push(...data.mediaIds.filter((x): x is string => typeof x === 'string'))
    if (block.type === 'rich_text') walk(data.doc)
  }
  return [...new Set(ids)]
}

export async function getPublicArticle(db: Db, slug: string): Promise<PublicArticle | null> {
  const post = await getPublishedPostBySlug(db, slug)
  if (!post) return null
  const [categoryResult, tagResult, media] = await Promise.all([
    db.from('categories').select('id, slug, name').eq('id', post.category_id).maybeSingle(),
    db.from('post_tags').select('tags(slug, name)').eq('post_id', post.id),
    getMediaByIds(db, [...(post.cover_media_id ? [post.cover_media_id] : []), ...mediaIdsInBody(post.body)]),
  ])
  if (categoryResult.error) raise(categoryResult.error, 'getPublicArticle.category')
  if (tagResult.error) raise(tagResult.error, 'getPublicArticle.tags')
  const tags = ((tagResult.data ?? []) as unknown as { tags: TagRow | null }[])
    .map((row) => row.tags)
    .filter((t): t is TagRow => Boolean(t))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { post, category: (categoryResult.data as CategoryRow | null) ?? null, tags, media }
}

export interface TagWithId extends TagRow {
  id: string
}

/** Every tag with its id, for the editor's tag picker. */
export async function listAllTags(db: Db): Promise<TagWithId[]> {
  const { data, error } = await db.from('tags').select('id, slug, name').order('name')
  if (error) raise(error, 'listAllTags')
  return (data ?? []) as TagWithId[]
}

export async function getPostTagIds(db: Db, postId: string): Promise<string[]> {
  const { data, error } = await db.from('post_tags').select('tag_id').eq('post_id', postId)
  if (error) raise(error, 'getPostTagIds')
  return ((data ?? []) as { tag_id: string }[]).map((r) => r.tag_id)
}
