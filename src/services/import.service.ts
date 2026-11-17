import { CAPTION_MAX } from '@/blocks'
import type { ActionContext } from '@/lib/action'
import type { Db } from '@/lib/supabase/server'
import { AppError } from '@/domain/result'
import { ALLOWED_IMAGE_TYPES, saveImage } from '@/data/media.repo'
import * as posts from '@/data/posts.repo'
import { findSource, insertSource } from '@/data/sources.repo'
import type { ImporterRegistry } from '@/integrations/importers/registry'
import { safeDownload } from '@/integrations/safe-fetch'
import { uniqueSlug } from './posts.service'

export const MAX_SLIDES = 20
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export interface ImportDeps {
  importers: ImporterRegistry
  getToken: (provider: string) => Promise<string>
  download?: typeof safeDownload
}

export interface ImportRequest {
  link: string
  categoryId: string
}

/** First line of the caption becomes the working headline; the editor can change it afterwards. */
export function headlineFromCaption(caption: string): string {
  const first = caption.split('\n').map((line) => line.trim()).find(Boolean) ?? ''
  return first.slice(0, 160) || 'Imported post'
}

/**
 * Turns a pasted link into a draft gallery post:
 * resolve the source -> fetch the post -> copy its images into our own storage -> create the draft -> record where it came from.
 * Images are copied because addresses handed out by social networks expire.
 */
export async function importFromLink({ db, user }: ActionContext<Db>, request: ImportRequest, deps: ImportDeps): Promise<{ postId: string; slides: number }> {
  const { importer, url } = deps.importers.resolve(request.link)
  const token = await deps.getToken(importer.provider)
  const imported = await importer.fetchPost(url, token)

  const existing = await findSource(db, imported.provider, imported.externalId)
  if (existing?.post_id) throw new AppError('conflict', 'That post has already been imported.')
  if (imported.imageUrls.length === 0) throw new AppError('invalid_input', 'That post has no images to import.')

  const download = deps.download ?? safeDownload
  const title = headlineFromCaption(imported.caption)
  const mediaIds: string[] = []
  for (const [index, imageUrl] of imported.imageUrls.slice(0, MAX_SLIDES).entries()) {
    const file = await download(imageUrl, { allowedHosts: importer.imageHosts, allowedTypes: ALLOWED_IMAGE_TYPES, maxBytes: MAX_IMAGE_BYTES })
    const media = await saveImage(db, { ...file, alt: `${title}, slide ${index + 1}`, source: 'instagram', createdBy: user.id })
    mediaIds.push(media.id)
  }

  const post = await posts.insertPost(db, {
    slug: await uniqueSlug(db, title),
    title,
    kind: 'gallery',
    status: 'draft',
    category_id: request.categoryId,
    cover_media_id: mediaIds[0] ?? null,
    source_url: imported.permalink,
    author_id: user.id,
    body: { version: 1, blocks: [{ id: crypto.randomUUID(), type: 'gallery', data: { mediaIds, caption: imported.caption.slice(0, CAPTION_MAX) } }] },
  })
  await posts.setPostMedia(db, post.id, mediaIds)
  await insertSource(db, { postId: post.id, provider: imported.provider, externalId: imported.externalId, permalink: imported.permalink, caption: imported.caption })
  return { postId: post.id, slides: mediaIds.length }
}
