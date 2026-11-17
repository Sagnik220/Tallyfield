import { z } from 'zod'
import { defineBlock } from '../types'
import { mediaId, text } from '../shared'

export const image = defineBlock({
  type: 'image',
  label: 'Image',
  schema: z.object({ mediaId, caption: text(200).default(''), tilt: z.boolean().default(true) }),
  empty: () => ({ mediaId: '00000000-0000-4000-8000-000000000000', caption: '', tilt: true }),
  toPlainText: (d) => d.caption,
})
