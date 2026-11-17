import type { z } from 'zod'

/**
 * One kind of content block (heading, image, verdict, ...).
 * To add a block: create a file in ./definitions, export a definition, add it to ./index.ts.
 * Nothing else in the codebase needs to change.
 */
export interface BlockDefinition<TSchema extends z.ZodType = z.ZodType> {
  /** Stable identifier stored in the database. Never rename once posts use it. */
  type: string
  /** Name shown in the editor's "Add a block" list. */
  label: string
  /** Shape of this block's data. Checked on every save. */
  schema: TSchema
  /** Data for a newly added, empty block. */
  empty: () => z.input<TSchema>
  /** Plain text of the block, used for search indexing and previews. */
  toPlainText: (data: z.output<TSchema>) => string
}

/** A block as stored inside posts.body.blocks. */
export interface StoredBlock {
  id: string
  type: string
  data: unknown
}

export interface Body {
  version: 1
  blocks: StoredBlock[]
}

export function defineBlock<TSchema extends z.ZodType>(def: BlockDefinition<TSchema>): BlockDefinition<TSchema> {
  return def
}
