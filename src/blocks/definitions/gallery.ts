import { z } from 'zod'
import { defineBlock } from '../types'
import { mediaId, text } from '../shared'

/** Longest caption a gallery can hold. Instagram stops at 2,200; on the site captions can be edited much longer. */
export const CAPTION_MAX = 50_000

export const gallery = defineBlock({
  type: 'gallery',
  label: 'Slide gallery',
  schema: z.object({ mediaIds: z.array(mediaId).min(1).max(20), caption: text(CAPTION_MAX).default('') }),
  empty: () => ({ mediaIds: ['00000000-0000-4000-8000-000000000000'], caption: '' }),
  toPlainText: (d) => d.caption,
})
