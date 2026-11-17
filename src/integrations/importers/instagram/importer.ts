import type { ImportedPost, SourceImporter } from '../types'
import { findOwnMediaByShortcode, type InstagramClientOptions, type InstagramMedia } from './client'
import { isInstagramUrl, parseInstagramPermalink } from './url'

export function createInstagramImporter(options: InstagramClientOptions): SourceImporter {
  return {
    provider: 'instagram',
    imageHosts: ['cdninstagram.com', 'fbcdn.net'],
    matches: isInstagramUrl,
    async fetchPost(url, accessToken): Promise<ImportedPost> {
      const { shortcode, permalink } = parseInstagramPermalink(url)
      const media = await findOwnMediaByShortcode(accessToken, shortcode, options)
      return { ...toImportedPost(media), permalink }
    },
  }
}

/** Carousel: one image per slide. Single post: its own image. Videos (and video slides) are skipped. */
export function toImportedPost(media: InstagramMedia): ImportedPost {
  const items = media.children?.data ?? [media]
  const imageUrls = items.filter((m) => m.media_type === 'IMAGE' && m.media_url).map((m) => m.media_url!)
  let permalink = media.permalink
  try {
    permalink = parseInstagramPermalink(new URL(media.permalink)).permalink
  } catch {
    // Keep Instagram's own link if it is in an unexpected shape.
  }
  return { provider: 'instagram', externalId: media.id, permalink, caption: media.caption ?? '', imageUrls }
}
