import type { ActionContext } from '@/lib/action'
import type { Db } from '@/lib/supabase/server'
import { AppError } from '@/domain/result'
import type { PostInput, PostStatus, PostUpdate } from '@/domain/post'
import { slugify } from '@/domain/slug'
import * as posts from '@/data/posts.repo'
import type { PostRow } from '@/data/types'

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
  if (slug !== undefined) {
    const current = await posts.getPostById(db, id)
    // A published address is permanent: links shared on Instagram must keep working.
    if (current.slug !== slug && current.published_at) throw new AppError('conflict', 'The web address of a published post cannot be changed.')
    values.slug = slug
  }
  const post = await posts.updatePost(db, id, values)
  if (tagIds !== undefined) await posts.setPostTags(db, id, tagIds)
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
