import { z } from 'zod'
import { defineBlock } from '../types'
import { requiredText } from '../shared'

export const heading = defineBlock({
  type: 'heading',
  label: 'Heading',
  schema: z.object({ text: requiredText(120), level: z.union([z.literal(2), z.literal(3)]).default(2) }),
  empty: () => ({ text: 'New heading', level: 2 as const }),
  toPlainText: (d) => d.text,
})
