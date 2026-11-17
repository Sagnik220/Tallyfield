import { z } from 'zod'
import { defineBlock } from '../types'
import { mediaId, text } from '../shared'

export const gallery = defineBlock({
  type: 'gallery',
  label: 'Slide gallery',
  schema: z.object({ mediaIds: z.array(mediaId).min(1).max(20), caption: text(2200).default('') }),
  empty: () => ({ mediaIds: ['00000000-0000-4000-8000-000000000000'], caption: '' }),
  toPlainText: (d) => d.caption,
})
