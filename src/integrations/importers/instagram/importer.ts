import type { ImportedPost, SourceImporter } from '../types'
import { findOwnMediaByShortcode, type InstagramClientOptions } from './client'
import { isInstagramUrl, parseInstagramPermalink } from './url'

export function createInstagramImporter(options: InstagramClientOptions): SourceImporter {
  return {
    provider: 'instagram',
    imageHosts: ['cdninstagram.com', 'fbcdn.net'],
    matches: isInstagramUrl,
    async fetchPost(url, accessToken): Promise<ImportedPost> {
      const { shortcode, permalink } = parseInstagramPermalink(url)
      const media = await findOwnMediaByShortcode(accessToken, shortcode, options)
      // Carousel: one image per slide. Single post: its own image. Videos are skipped.
      const items = media.children?.data ?? [media]
      const imageUrls = items.filter((m) => m.media_type === 'IMAGE' && m.media_url).map((m) => m.media_url!)
      return { provider: 'instagram', externalId: media.id, permalink, caption: media.caption ?? '', imageUrls }
    },
  }
}
