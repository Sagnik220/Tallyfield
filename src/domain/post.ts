import { z } from 'zod'
import { bodySchema } from '@/blocks'
import { SLUG_PATTERN } from './slug'

export const POST_STATUSES = ['draft', 'published', 'archived'] as const
export const POST_KINDS = ['gallery', 'article'] as const
export type PostStatus = (typeof POST_STATUSES)[number]
export type PostKind = (typeof POST_KINDS)[number]

const id = z.uuid()

/** Field rules shared by create and update. No defaults here: see below. */
const postFields = {
  title: z.string().trim().min(1).max(160),
  deck: z.string().trim().max(300),
  slug: z.string().regex(SLUG_PATTERN).max(120),
  kind: z.enum(POST_KINDS),
  categoryId: id,
  tagIds: z.array(id).max(20),
  coverMediaId: id.nullable(),
  body: bodySchema,
  sourceUrl: z.url({ protocol: /^https$/ }).nullable(),
  pricesCheckedOn: z.iso.date().nullable(),
  priceSources: z.string().trim().max(300),
}

/** What the editor submits for a new post. The database enforces the same limits again. */
export const postInputSchema = z.object({
  ...postFields,
  deck: postFields.deck.default(''),
  slug: postFields.slug.optional(),
  kind: postFields.kind.default('article'),
  tagIds: postFields.tagIds.default([]),
  coverMediaId: postFields.coverMediaId.default(null),
  sourceUrl: postFields.sourceUrl.default(null),
  pricesCheckedOn: postFields.pricesCheckedOn.default(null),
  priceSources: postFields.priceSources.default(''),
})
export type PostInput = z.infer<typeof postInputSchema>

/**
 * An update changes only the fields it sends. Built from the default-free fields on purpose:
 * zod applies .default() even inside .partial(), which would silently wipe tags, the source link and so on.
 */
export const postUpdateSchema = z.object(postFields).partial().extend({ id })
export type PostUpdate = z.infer<typeof postUpdateSchema>

export const postIdSchema = z.object({ id })

export const searchParamsSchema = z.object({
  q: z.string().trim().max(100).default(''),
  category: z.string().regex(SLUG_PATTERN).optional(),
  tags: z.array(z.string().regex(SLUG_PATTERN)).max(10).default([]),
  page: z.coerce.number().int().min(1).max(500).default(1),
})
export type SearchParams = z.infer<typeof searchParamsSchema>

export interface PostSummary {
  id: string
  slug: string
  title: string
  deck: string
  kind: PostKind
  categorySlug: string
  categoryName: string
  coverPath: string | null
  coverAlt: string | null
  tags: string[]
  publishedAt: string | null
}
