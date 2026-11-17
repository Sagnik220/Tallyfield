import type { ActionContext } from '@/lib/action'
import type { Db } from '@/lib/supabase/server'
import { AppError } from '@/domain/result'
import type { PostInput, PostStatus, PostUpdate } from '@/domain/post'
import { slugify } from '@/domain/slug'
import * as posts from '@/data/posts.repo'
import type { PostRow } from '@/data/types'
import { mediaIdsInBody } from '@/data/public.repo'

type Ctx = ActionContext<Db>

/** Picks a free web address: "title", then "title-2", "title-3", ... */
export async function uniqueSlug(db: Db, wanted: string): Promise<string> {
  const base = slugify(wanted)
  for (let n = 1; n <= 50; n += 1) {
    const candidate = n === 1 ? base : `${base.slice(0, 115)}-${n}`
    if (!(await posts.slugExists(db, candidate))) return candidate
  }
  throw new AppError('conflict', 'Could not find a free web address for that title.')
}

/** JSON with object keys sorted, so two equal documents compare equal whatever order the database stored keys in. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
  )
}

function toRow(input: Partial<PostInput>): posts.PostWrite {
  const row: posts.PostWrite = {}
  if (input.title !== undefined) row.title = input.title
  if (input.deck !== undefined) row.deck = input.deck
  if (input.kind !== undefined) row.kind = input.kind
  if (input.categoryId !== undefined) row.category_id = input.categoryId
  if (input.coverMediaId !== undefined) row.cover_media_id = input.coverMediaId
  if (input.body !== undefined) row.body = input.body
  if (input.sourceUrl !== undefined) row.source_url = input.sourceUrl
  if (input.pricesCheckedOn !== undefined) row.prices_checked_on = input.pricesCheckedOn
  if (input.priceSources !== undefined) row.price_sources = input.priceSources
  return row
}

/** Creates a draft. Publishing is a separate, explicit step. */
export async function createPost({ db, user }: Ctx, input: PostInput): Promise<PostRow> {
  const slug = await uniqueSlug(db, input.slug ?? input.title)
  const post = await posts.insertPost(db, { ...toRow(input), slug, status: 'draft', author_id: user.id })
  await posts.setPostTags(db, post.id, input.tagIds)
  return post
}

export async function updatePost({ db }: Ctx, input: PostUpdate): Promise<PostRow> {
  const { id, tagIds, slug, ...rest } = input
  const values = toRow(rest)
  const current = values.title !== undefined || values.deck !== undefined || values.body !== undefined || slug !== undefined ? await posts.getPostById(db, id) : null
  // A real change to the words marks the post as edited by hand, so Instagram sync will not overwrite it.
  if (
    current &&
    ((values.title !== undefined && values.title !== current.title) ||
      (values.deck !== undefined && values.deck !== current.deck) ||
      (values.body !== undefined && stableJson(values.body) !== stableJson(current.body)))
  ) {
    values.content_edited_at = new Date().toISOString()
  }
  if (slug !== undefined && current) {
    // A published address is permanent: links shared on Instagram must keep working.
    if (current.slug !== slug && current.published_at) throw new AppError('conflict', 'The web address of a published post cannot be changed.')
    values.slug = slug
  }
  const post = await posts.updatePost(db, id, values)
  if (tagIds !== undefined) await posts.setPostTags(db, id, tagIds)
  // Keep the post's media links in step with what the body and cover use; this is what lets visitors see them.
  if (values.body !== undefined || values.cover_media_id !== undefined) {
    const ids = mediaIdsInBody(post.body)
    if (post.cover_media_id && !ids.includes(post.cover_media_id)) ids.unshift(post.cover_media_id)
    await posts.setPostMedia(db, id, ids)
  }
  return post
}

export async function setPostStatus({ db }: Ctx, id: string, status: PostStatus): Promise<PostRow> {
  if (status === 'published') {
    const post = await posts.getPostById(db, id)
    if (post.body.blocks.length === 0) throw new AppError('invalid_input', 'Add some content before publishing.')
  }
  return posts.updatePost(db, id, { status })
}

export async function removePost({ db }: Ctx, id: string): Promise<void> {
  await posts.deletePost(db, id)
}
