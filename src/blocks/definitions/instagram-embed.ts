import { z } from 'zod'
import { defineBlock } from '../types'

/** Only the post's address is stored. The page builds Instagram's embed from it; no third-party HTML is saved. */
export const INSTAGRAM_PERMALINK = /^https:\/\/www\.instagram\.com\/(p|reel)\/[A-Za-z0-9_-]{5,40}\/$/

export const instagramEmbed = defineBlock({
  type: 'instagram_embed',
  label: 'Instagram embed',
  schema: z.object({ permalink: z.string().regex(INSTAGRAM_PERMALINK, 'Must be an instagram.com post link') }),
  empty: () => ({ permalink: 'https://www.instagram.com/p/XXXXXXXXXXX/' }),
  toPlainText: () => '',
})
