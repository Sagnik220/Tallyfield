import { z } from 'zod'
import { defineBlock } from '../types'
import { requiredText } from '../shared'

export const textBlock = defineBlock({
  type: 'text',
  label: 'Text',
  // Paragraphs are separated by blank lines. No markup is stored.
  schema: z.object({ text: requiredText(5000) }),
  empty: () => ({ text: 'Write here.' }),
  toPlainText: (d) => d.text,
})
