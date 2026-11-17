import { z } from 'zod'
import { defineBlock } from '../types'
import { requiredText, text } from '../shared'

export const specTable = defineBlock({
  type: 'spec_table',
  label: 'Spec table',
  schema: z
    .object({
      columns: z.array(requiredText(60)).min(2).max(4),
      rows: z.array(z.object({ label: requiredText(40), values: z.array(text(80)).min(2).max(4) })).min(1).max(30),
      note: text(300).default(''),
    })
    .refine((t) => t.rows.every((r) => r.values.length === t.columns.length), {
      message: 'Every row needs one value per column',
      path: ['rows'],
    }),
  empty: () => ({ columns: ['Watch A', 'Watch B'], rows: [{ label: 'Movement', values: ['', ''] }], note: '' }),
  toPlainText: (d) => [d.columns.join(' vs '), ...d.rows.map((r) => `${r.label}: ${r.values.join(' / ')}`), d.note].join('\n'),
})
