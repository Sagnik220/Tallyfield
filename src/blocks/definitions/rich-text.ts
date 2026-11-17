import { z } from 'zod'
import { defineBlock } from '../types'
import { INSTAGRAM_PERMALINK } from './instagram-embed'

/**
 * Rich text written in the editor: headings, styled text, lists, quotes, images, GIFs, videos and embeds.
 *
 * Stored as a document tree (the editor's JSON), never as HTML. Every node type, mark, attribute and value is on
 * an allow-list below, so pasted content cannot smuggle scripts, iframes from other sites or arbitrary styles onto
 * the site. Font sizes, fonts and colours are limited to the house choices.
 */

export const FONT_SIZES = ['14px', '16px', '18px', '22px', '28px', '36px', '48px'] as const
export const FONT_FAMILIES = ['display', 'sans', 'serif'] as const
export const COLORS = ['#F6E7D4', '#CFC3B0', '#A39A8A', '#C8A86B', '#B0925E', '#D9A35B', '#7E9470', '#FFFFFF'] as const
export const HIGHLIGHTS = ['#3A2F1A', '#1E3A33', '#3D2424', '#2A2A2A'] as const
const ALIGN = z.enum(['left', 'center', 'right', 'justify'])
const STORAGE_PATH = /^(upload|instagram)\/[0-9a-f-]{36}\.(jpg|png|webp|avif|gif|mp4|webm|mov)$/
export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

const mark = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({ type: z.literal('underline') }),
  z.object({ type: z.literal('strike') }),
  z.object({
    type: z.literal('link'),
    attrs: z.object({ href: z.string().max(500).regex(/^(https:\/\/|mailto:|\/(?!\/))/, 'Links must be https, mailto or a site path') }).loose(),
  }),
  z.object({
    type: z.literal('textStyle'),
    attrs: z
      .object({
        fontSize: z.enum(FONT_SIZES).nullish(),
        fontFamily: z.enum(FONT_FAMILIES).nullish(),
        color: z.enum(COLORS).nullish(),
      })
      .loose(),
  }),
  z.object({ type: z.literal('highlight'), attrs: z.object({ color: z.enum(HIGHLIGHTS).nullish() }).loose().optional() }),
])

export type RichMark = z.infer<typeof mark>

const text = z.object({ type: z.literal('text'), text: z.string().min(1).max(20_000), marks: z.array(mark).max(8).optional() })
const hardBreak = z.object({ type: z.literal('hardBreak') })
const inline = z.union([text, hardBreak])

const paragraph = z.object({
  type: z.literal('paragraph'),
  attrs: z.object({ textAlign: ALIGN.nullish() }).loose().optional(),
  content: z.array(inline).max(2000).optional(),
})
const heading = z.object({
  type: z.literal('heading'),
  attrs: z.object({ level: z.union([z.literal(2), z.literal(3), z.literal(4)]), textAlign: ALIGN.nullish() }).loose(),
  content: z.array(inline).max(500).optional(),
})
const media = z.object({
  type: z.literal('media'),
  attrs: z
    .object({
      mediaId: z.uuid(),
      path: z.string().regex(STORAGE_PATH),
      kind: z.enum(['image', 'video']),
      alt: z.string().max(300).default(''),
      caption: z.string().max(300).default(''),
      width: z.number().int().positive().max(20_000).nullish(),
      height: z.number().int().positive().max(20_000).nullish(),
    })
    .loose(),
})
const embed = z.object({
  type: z.literal('embed'),
  attrs: z.discriminatedUnion('provider', [
    z.object({ provider: z.literal('youtube'), id: z.string().regex(YOUTUBE_ID) }).loose(),
    z.object({ provider: z.literal('instagram'), id: z.string().regex(INSTAGRAM_PERMALINK) }).loose(),
  ]),
})
const rule = z.object({ type: z.literal('horizontalRule') })

// Lists and quotes contain other blocks, so the schema is recursive.
type Node = z.infer<typeof paragraph> | z.infer<typeof heading> | z.infer<typeof media> | z.infer<typeof embed> | z.infer<typeof rule> | Container
interface Container {
  type: 'bulletList' | 'orderedList' | 'listItem' | 'blockquote'
  attrs?: Record<string, unknown> | undefined
  content?: Node[] | undefined
}
const node: z.ZodType<Node> = z.lazy(() =>
  z.union([
    paragraph,
    heading,
    media,
    embed,
    rule,
    z.object({
      type: z.enum(['bulletList', 'orderedList', 'listItem', 'blockquote']),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(node).max(500).optional(),
    }),
  ]),
) as z.ZodType<Node>

export type RichNode = Node
export const MAX_RICH_TEXT_BYTES = 300_000

export const richDoc = z
  .object({ type: z.literal('doc'), content: z.array(node).max(2000) })
  .refine((d) => JSON.stringify(d).length <= MAX_RICH_TEXT_BYTES, { message: 'This section is too long. Split it into two.' })

function plain(n: unknown): string {
  if (!n || typeof n !== 'object') return ''
  const o = n as { type?: string; text?: string; content?: unknown[]; attrs?: { caption?: string } }
  if (o.type === 'text') return o.text ?? ''
  if (o.type === 'media') return o.attrs?.caption ?? ''
  const inner = (o.content ?? []).map(plain).join(o.type === 'paragraph' || o.type === 'heading' ? '' : '\n')
  return inner
}

export const richText = defineBlock({
  type: 'rich_text',
  label: 'Rich text',
  schema: z.object({ doc: richDoc }),
  empty: () => ({ doc: { type: 'doc' as const, content: [{ type: 'paragraph' as const }] } }),
  toPlainText: (d) => plain(d.doc).replace(/\n{3,}/g, '\n\n').trim(),
})
