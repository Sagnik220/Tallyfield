import type { Body } from '@/blocks'
import type { PostKind, PostStatus } from '@/domain/post'

/** Row shapes. Replace with generated types once the project is linked: `npm run db:types`. */
export interface PostRow {
  id: string
  slug: string
  title: string
  deck: string
  kind: PostKind
  status: PostStatus
  category_id: string
  cover_media_id: string | null
  body: Body
  source_url: string | null
  prices_checked_on: string | null
  price_sources: string
  author_id: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface MediaRow {
  id: string
  storage_path: string
  alt: string
  width: number | null
  height: number | null
  mime_type: string
  source: 'upload' | 'instagram'
}

export interface SearchRow {
  id: string
  slug: string
  title: string
  deck: string
  kind: PostKind
  category_slug: string
  category_name: string
  cover_path: string | null
  cover_alt: string | null
  tags: string[]
  published_at: string | null
}
