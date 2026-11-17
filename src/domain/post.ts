import { z } from 'zod'
import { bodySchema } from '@/blocks'
import { SLUG_PATTERN } from './slug'

export const POST_STATUSES = ['draft', 'published', 'archived'] as const
export const POST_KINDS = ['gallery', 'article'] as const
export type PostStatus = (typeof POST_STATUSES)[number]
export type PostKind = (typeof POST_KINDS)[number]

const id = z.uuid()

/** What the editor submits. The database enforces the same limits again. */
export const postInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  deck: z.string().trim().max(300).default(''),
  slug: z.string().regex(SLUG_PATTERN).max(120).optional(),
  kind: z.enum(POST_KINDS).default('article'),
  categoryId: id,
  tagIds: z.array(id).max(20).default([]),
  coverMediaId: id.nullable().default(null),
  body: bodySchema,
  sourceUrl: z.url({ protocol: /^https$/ }).nullable().default(null),
  pricesCheckedOn: z.iso.date().nullable().default(null),
  priceSources: z.string().trim().max(300).default(''),
})
export type PostInput = z.infer<typeof postInputSchema>

export const postUpdateSchema = postInputSchema.partial().extend({ id })
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
