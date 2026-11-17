import { z } from 'zod'
import { defineBlock } from '../types'
import { mediaId, priceInr, requiredText, text } from '../shared'

export const verdict = defineBlock({
  type: 'verdict',
  label: 'Verdict',
  schema: z.object({
    eyebrow: text(80).default('The Tallyfield verdict'),
    pick: requiredText(80),
    priceInr: priceInr.nullable().default(null),
    summary: text(160).default(''),
    mediaId: mediaId.nullable().default(null),
    reasons: z.array(requiredText(200)).min(1).max(5),
    // House rule: every verdict names one drawback.
    drawback: requiredText(200),
    runnerUp: z.object({ name: requiredText(80), line: text(200).default('') }).nullable().default(null),
  }),
  empty: () => ({ pick: 'The one I would buy', reasons: ['Reason'], drawback: 'Drawback' }),
  toPlainText: (d) => [d.pick, d.summary, ...d.reasons, d.drawback, d.runnerUp?.name ?? ''].join('\n'),
})
