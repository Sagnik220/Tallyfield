import { z } from 'zod'
import { defineBlock } from '../types'
import { priceInr, requiredText, text } from '../shared'

export const priceTable = defineBlock({
  type: 'price_table',
  label: 'Price table',
  schema: z.object({
    rows: z
      .array(z.object({ model: requiredText(80), priceInr, movement: text(60).default(''), note: text(120).default('') }))
      .min(1)
      .max(40),
    // House rule: an India price is never shown without where and when it was checked.
    source: requiredText(200),
    checkedOn: z.iso.date(),
  }),
  empty: () => ({ rows: [{ model: 'Model', priceInr: 1, movement: '', note: '' }], source: 'Retailer', checkedOn: '2026-01-01' }),
  toPlainText: (d) => d.rows.map((r) => `${r.model} ₹${r.priceInr} ${r.note}`).join('\n'),
})
