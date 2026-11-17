import { BlockRegistry } from './registry'
import { gallery } from './definitions/gallery'
import { heading } from './definitions/heading'
import { image } from './definitions/image'
import { instagramEmbed } from './definitions/instagram-embed'
import { priceTable } from './definitions/price-table'
import { specTable } from './definitions/spec-table'
import { textBlock } from './definitions/text'
import { verdict } from './definitions/verdict'

/** Every block the site understands. Add new blocks here. */
export const blocks = new BlockRegistry()
  .register(heading)
  .register(textBlock)
  .register(image)
  .register(gallery)
  .register(specTable)
  .register(priceTable)
  .register(verdict)
  .register(instagramEmbed)

export const bodySchema = blocks.bodySchema()
export const emptyBody = () => ({ version: 1 as const, blocks: [] })

export { BlockRegistry } from './registry'
export type { BlockDefinition, Body, StoredBlock } from './types'
