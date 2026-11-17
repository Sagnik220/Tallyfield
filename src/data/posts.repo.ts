import type { Db } from '@/lib/supabase/server'
import { AppError } from '@/domain/result'
import type { PostStatus } from '@/domain/post'
import { raise } from './errors'
import type { PostRow } from './types'

const COLUMNS =
  'id, slug, title, deck, kind, status, category_id, cover_media_id, body, source_url, prices_checked_on, price_sources, author_id, published_at, created_at, updated_at'

export type PostWrite = Partial<Omit<PostRow, 'id' | 'created_at' | 'updated_at' | 'published_at'>>

export async function getPostById(db: Db, id: string): Promise<PostRow> {
  const { data, error } = await db.from('posts').select(COLUMNS).eq('id', id).maybeSingle()
  if (error) raise(error, 'getPostById')
  if (!data) throw new AppError('not_found', 'That post no longer exists.')
  return data as unknown as PostRow
}

/** Published post for the public article page. Drafts are invisible here because of row level security. */
export async function getPublishedPostBySlug(db: Db, slug: string): Promise<PostRow | null> {
  const { data, error } = await db.from('posts').select(COLUMNS).eq('slug', slug).eq('status', 'published').maybeSingle()
  if (error) raise(error, 'getPublishedPostBySlug')
  return (data as unknown as PostRow | null) ?? null
}

export async function listPostsForAdmin(db: Db, status?: PostStatus): Promise<PostRow[]> {
  let query = db.from('posts').select(COLUMNS).order('updated_at', { ascending: false }).limit(200)
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) raise(error, 'listPostsForAdmin')
  return (data ?? []) as unknown as PostRow[]
}

export async function slugExists(db: Db, slug: string): Promise<boolean> {
  const { count, error } = await db.from('posts').select('id', { count: 'exact', head: true }).eq('slug', slug)
  if (error) raise(error, 'slugExists')
  return (count ?? 0) > 0
}

export async function insertPost(db: Db, values: PostWrite): Promise<PostRow> {
  const { data, error } = await db.from('posts').insert(values).select(COLUMNS).single()
  if (error) raise(error, 'insertPost')
  return data as unknown as PostRow
}

export async function updatePost(db: Db, id: string, values: PostWrite): Promise<PostRow> {
  const { data, error } = await db.from('posts').update(values).eq('id', id).select(COLUMNS).maybeSingle()
  if (error) raise(error, 'updatePost')
  if (!data) throw new AppError('not_found', 'That post no longer exists.')
  return data as unknown as PostRow
}

export async function deletePost(db: Db, id: string): Promise<void> {
  const { data, error } = await db.from('posts').delete().eq('id', id).select('id')
  if (error) raise(error, 'deletePost')
  if (!data?.length) throw new AppError('forbidden', 'Only an admin can delete a post.')
}

/** Replaces a post's tags with exactly the given set. */
export async function setPostTags(db: Db, postId: string, tagIds: string[]): Promise<void> {
  const { error: removeError } = await db.from('post_tags').delete().eq('post_id', postId)
  if (removeError) raise(removeError, 'setPostTags.remove')
  if (tagIds.length === 0) return
  const { error } = await db.from('post_tags').insert(tagIds.map((tag_id) => ({ post_id: postId, tag_id })))
  if (error) raise(error, 'setPostTags.insert')
}

export async function setPostMedia(db: Db, postId: string, mediaIds: string[]): Promise<void> {
  const { error: removeError } = await db.from('post_media').delete().eq('post_id', postId)
  if (removeError) raise(removeError, 'setPostMedia.remove')
  if (mediaIds.length === 0) return
  const rows = mediaIds.map((media_id, position) => ({ post_id: postId, media_id, position }))
  const { error } = await db.from('post_media').insert(rows)
  if (error) raise(error, 'setPostMedia.insert')
}
