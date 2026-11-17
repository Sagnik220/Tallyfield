'use server'

import { getMediaByIds, mediaIdsInBody } from '@/data/public.repo'
import { getPostById } from '@/data/posts.repo'
import { postIdSchema } from '@/domain/post'
import { STAFF } from '@/domain/roles'
import { mediaUrl } from '@/lib/media-url'
import { action } from '../action'

export interface DraftView {
  id: string
  slug: string
  title: string
  deck: string
  status: string
  categoryId: string
  coverMediaId: string | null
  galleryBlockId: string | null
  caption: string
  slides: { id: string; url: string; alt: string }[]
}

const getDraft = action({
  name: 'posts.getDraft',
  roles: STAFF,
  schema: postIdSchema,
  handler: async ({ id }, { db }): Promise<DraftView> => {
    const post = await getPostById(db, id)
    const gallery = post.body.blocks.find((b) => b.type === 'gallery')
    const galleryData = (gallery?.data ?? {}) as { mediaIds?: string[]; caption?: string }
    const ids = galleryData.mediaIds ?? mediaIdsInBody(post.body)
    const media = await getMediaByIds(db, ids)
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      deck: post.deck,
      status: post.status,
      categoryId: post.category_id,
      coverMediaId: post.cover_media_id,
      galleryBlockId: gallery?.id ?? null,
      caption: galleryData.caption ?? '',
      slides: ids.filter((m) => media[m]).map((m) => ({ id: m, url: mediaUrl(media[m]!.storage_path), alt: media[m]!.alt })),
    }
  },
})

export async function getDraftAction(input: unknown) {
  return getDraft(input)
}
