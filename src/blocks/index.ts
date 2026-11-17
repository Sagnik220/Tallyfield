import { BlockRegistry } from './registry'
import { gallery } from './definitions/gallery'
import { heading } from './definitions/heading'
import { image } from './definitions/image'
import { instagramEmbed } from './definitions/instagram-embed'
import { priceTable } from './definitions/price-table'
import { richText } from './definitions/rich-text'
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
  .register(richText)

export const bodySchema = blocks.bodySchema()
export const emptyBody = () => ({ version: 1 as const, blocks: [] })

export { COLORS, FONT_FAMILIES, FONT_SIZES, HIGHLIGHTS, YOUTUBE_ID } from './definitions/rich-text'
export type { RichMark, RichNode } from './definitions/rich-text'

export { BlockRegistry } from './registry'
export type { BlockDefinition, Body, StoredBlock } from './types'
