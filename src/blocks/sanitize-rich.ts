import { COLORS, FONT_FAMILIES, FONT_SIZES, HIGHLIGHTS } from './definitions/rich-text'

/**
 * Cleans an editor document before saving. Text pasted from other sites, Word or Google Docs carries styles the
 * site does not allow (odd font sizes, rgb() colours, unknown blocks). Instead of rejecting the save, this keeps
 * the words and drops whatever is not on the allow-list. The result still passes through the strict schema.
 */

type Json = Record<string, unknown>
const BLOCKS = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'horizontalRule', 'media', 'embed'])
const ALIGNS = new Set(['left', 'center', 'right', 'justify'])
const LINK = /^(https:\/\/|mailto:|\/(?!\/))/

function cleanMarks(marks: unknown): Json[] | undefined {
  if (!Array.isArray(marks)) return undefined
  const out: Json[] = []
  for (const m of marks as Json[]) {
    const attrs = (m.attrs ?? {}) as Json
    switch (m.type) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strike':
        out.push({ type: m.type })
        break
      case 'link':
        if (typeof attrs.href === 'string' && LINK.test(attrs.href) && attrs.href.length <= 500) out.push({ type: 'link', attrs: { href: attrs.href } })
        break
      case 'highlight': {
        const color = HIGHLIGHTS.includes(attrs.color as never) ? attrs.color : null
        out.push(color ? { type: 'highlight', attrs: { color } } : { type: 'highlight' })
        break
      }
      case 'textStyle': {
        const clean: Json = {}
        if (FONT_SIZES.includes(attrs.fontSize as never)) clean.fontSize = attrs.fontSize
        if (FONT_FAMILIES.includes(attrs.fontFamily as never)) clean.fontFamily = attrs.fontFamily
        if (typeof attrs.color === 'string' && COLORS.includes(attrs.color.toUpperCase() as never)) clean.color = attrs.color.toUpperCase()
        if (Object.keys(clean).length) out.push({ type: 'textStyle', attrs: clean })
        break
      }
    }
  }
  return out.length ? out.slice(0, 8) : undefined
}

function cleanInline(content: unknown): Json[] {
  if (!Array.isArray(content)) return []
  const out: Json[] = []
  for (const n of content as Json[]) {
    if (n.type === 'hardBreak') out.push({ type: 'hardBreak' })
    else if (n.type === 'text' && typeof n.text === 'string' && n.text.length) {
      const marks = cleanMarks(n.marks)
      out.push(marks ? { type: 'text', text: n.text.slice(0, 20_000), marks } : { type: 'text', text: n.text.slice(0, 20_000) })
    } else if (Array.isArray(n.content)) out.push(...cleanInline(n.content))
  }
  return out
}

function alignAttrs(attrs: unknown): Json | undefined {
  const a = (attrs as Json | undefined)?.textAlign
  return typeof a === 'string' && ALIGNS.has(a) && a !== 'left' ? { textAlign: a } : undefined
}

function cleanBlock(n: Json): Json[] {
  const type = String(n.type)
  if (!BLOCKS.has(type)) {
    // Unknown wrapper (table, div, code block…): keep its text as paragraphs.
    if (Array.isArray(n.content)) return (n.content as Json[]).flatMap((c) => (c.type === 'text' ? [{ type: 'paragraph', content: cleanInline([c]) }] : cleanBlock(c)))
    return []
  }
  switch (type) {
    case 'paragraph': {
      const content = cleanInline(n.content)
      const attrs = alignAttrs(n.attrs)
      return [{ type, ...(attrs ? { attrs } : {}), ...(content.length ? { content } : {}) }]
    }
    case 'heading': {
      const raw = Number((n.attrs as Json | undefined)?.level)
      const level = raw <= 2 ? 2 : raw === 3 ? 3 : 4
      const content = cleanInline(n.content)
      return [{ type, attrs: { level, ...(alignAttrs(n.attrs) ?? {}) }, ...(content.length ? { content } : {}) }]
    }
    case 'horizontalRule':
      return [{ type }]
    case 'media':
    case 'embed':
      return [{ type, attrs: { ...((n.attrs as Json) ?? {}) } }]
    default: {
      const content = Array.isArray(n.content) ? (n.content as Json[]).flatMap(cleanBlock) : []
      if (type === 'listItem' && content.length === 0) content.push({ type: 'paragraph' })
      return content.length ? [{ type, content }] : []
    }
  }
}

export function sanitizeRichDoc(doc: unknown): { type: 'doc'; content: Json[] } {
  const content = Array.isArray((doc as Json | null)?.content) ? ((doc as Json).content as Json[]).flatMap(cleanBlock) : []
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}
