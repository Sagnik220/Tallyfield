import { z } from 'zod'
import type { BlockDefinition, Body } from './types'

export const MAX_BLOCKS = 200

export class BlockRegistry {
  private readonly defs = new Map<string, BlockDefinition>()

  register(def: BlockDefinition): this {
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(def.type)) throw new Error(`Invalid block type name: ${def.type}`)
    if (this.defs.has(def.type)) throw new Error(`Block type registered twice: ${def.type}`)
    this.defs.set(def.type, def)
    return this
  }

  get(type: string): BlockDefinition | undefined {
    return this.defs.get(type)
  }

  list(): BlockDefinition[] {
    return [...this.defs.values()]
  }

  /** Schema for a whole post body. Unknown block types and malformed block data are rejected. */
  bodySchema() {
    const stored = z.object({ id: z.uuid(), type: z.string(), data: z.unknown() })
    return z
      .object({ version: z.literal(1), blocks: z.array(stored).max(MAX_BLOCKS) })
      .transform((body, ctx): Body => {
        const seen = new Set<string>()
        const blocks = body.blocks.map((block, index) => {
          if (seen.has(block.id)) {
            ctx.addIssue({ code: 'custom', path: ['blocks', index, 'id'], message: 'Duplicate block id' })
          }
          seen.add(block.id)
          const def = this.defs.get(block.type)
          if (!def) {
            ctx.addIssue({ code: 'custom', path: ['blocks', index, 'type'], message: `Unknown block type "${block.type}"` })
            return block
          }
          const parsed = def.schema.safeParse(block.data)
          if (!parsed.success) {
            for (const issue of parsed.error.issues) {
              ctx.addIssue({ code: 'custom', path: ['blocks', index, 'data', ...issue.path], message: issue.message })
            }
            return block
          }
          return { ...block, data: parsed.data }
        })
        return { version: 1, blocks }
      })
  }

  /** All readable text in a body, for previews and search. */
  toPlainText(body: Body): string {
    return body.blocks
      .map((block) => {
        const def = this.defs.get(block.type)
        const parsed = def?.schema.safeParse(block.data)
        return def && parsed?.success ? def.toPlainText(parsed.data) : ''
      })
      .filter(Boolean)
      .join('\n')
  }
}
