import type { RichMark, RichNode } from './definitions/rich-text'

/**
 * Turns caption-style Markdown (what people write in Instagram captions and paste from other tools) into a rich
 * text document: # headings, **bold**, *italic*, - lists, 1. lists, > quotes, --- dividers and [links](https://…).
 * Only builds allow-listed nodes, so the result passes the rich text schema like anything typed in the editor.
 * Lines that are only hashtags are dropped. Single line breaks inside a paragraph are kept (captions rely on them).
 */

type Inline = { type: 'text'; text: string; marks?: RichMark[] } | { type: 'hardBreak' }
type Doc = { type: 'doc'; content: RichNode[] }

const HASHTAGS_ONLY = /^\s*(#[\p{L}\p{N}_]+\s*)+$/u
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const BULLET = /^\s*[-*•]\s+(.*)$/
const ORDERED = /^\s*\d{1,3}[.)]\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/

/** Inline Markdown: links, bold, italic. Unmatched markers stay as plain characters. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  const push = (text: string, marks: RichMark[]) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.type === 'text' && JSON.stringify(last.marks ?? []) === JSON.stringify(marks)) last.text += text
    else out.push(marks.length ? { type: 'text', text, marks } : { type: 'text', text })
  }
  const walk = (s: string, marks: RichMark[]) => {
    const re = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)|\*\*(.+?)\*\*|__(.+?)__|(?<![\p{L}\p{N}*])\*(?!\s)(.+?)(?<!\s)\*(?![\p{L}\p{N}*])|(?<![\p{L}\p{N}_])_(?!\s)(.+?)(?<!\s)_(?![\p{L}\p{N}_])/gu
    let last = 0
    for (let m = re.exec(s); m; m = re.exec(s)) {
      push(s.slice(last, m.index), marks)
      if (m[1] !== undefined && m[2] !== undefined) walk(m[1], [...marks, { type: 'link', attrs: { href: m[2].slice(0, 500) } }])
      else if (m[3] !== undefined || m[4] !== undefined) walk((m[3] ?? m[4])!, marks.some((k) => k.type === 'bold') ? marks : [...marks, { type: 'bold' }])
      else walk((m[5] ?? m[6])!, marks.some((k) => k.type === 'italic') ? marks : [...marks, { type: 'italic' }])
      last = m.index + m[0].length
    }
    push(s.slice(last), marks)
  }
  walk(src, [])
  return out
}

function lines(inlines: string[]): Inline[] {
  const out: Inline[] = []
  inlines.forEach((l, i) => {
    if (i > 0) out.push({ type: 'hardBreak' })
    out.push(...parseInline(l))
  })
  return out
}

function para(text: string[]): RichNode {
  const content = lines(text)
  return (content.length ? { type: 'paragraph', content } : { type: 'paragraph' }) as RichNode
}

export function markdownToRichDoc(markdown: string): Doc {
  const raw = markdown.replace(/\r\n?/g, '\n').split('\n')
  const depths = raw.map((l) => HEADING.exec(l)?.[1]?.length).filter((d): d is number => d !== undefined && !HASHTAGS_ONLY.test(raw[0] ?? ''))
  const top = depths.length ? Math.min(...depths) : 1
  const level = (d: number) => Math.min(4, 2 + (d - top)) as 2 | 3 | 4

  const content: RichNode[] = []
  let paragraph: string[] = []
  let list: { kind: 'bulletList' | 'orderedList'; items: string[] } | null = null
  let quote: string[] = []

  const flush = () => {
    if (paragraph.length) content.push(para(paragraph))
    paragraph = []
    if (list) content.push({ type: list.kind, content: list.items.map((t) => ({ type: 'listItem', content: [para([t])] })) } as RichNode)
    list = null
    if (quote.length) content.push({ type: 'blockquote', content: [para(quote)] } as RichNode)
    quote = []
  }

  for (const line of raw) {
    if (!line.trim()) {
      flush()
      continue
    }
    if (HASHTAGS_ONLY.test(line)) continue
    if (RULE.test(line)) {
      flush()
      content.push({ type: 'horizontalRule' } as RichNode)
      continue
    }
    const h = HEADING.exec(line)
    if (h) {
      flush()
      const inner = parseInline(h[2]!.replace(/^\*\*(.*)\*\*$/, '$1'))
      content.push({ type: 'heading', attrs: { level: level(h[1]!.length) }, ...(inner.length ? { content: inner } : {}) } as RichNode)
      continue
    }
    const b = BULLET.exec(line)
    const o = b ? null : ORDERED.exec(line)
    if (b || o) {
      const kind = b ? 'bulletList' : 'orderedList'
      if (paragraph.length || quote.length || (list && list.kind !== kind)) flush()
      list ??= { kind, items: [] }
      list.items.push((b ?? o)![1]!)
      continue
    }
    const q = QUOTE.exec(line)
    if (q) {
      if (paragraph.length || list) flush()
      quote.push(q[1]!)
      continue
    }
    if (list || quote.length) flush()
    paragraph.push(line.trim())
  }
  flush()
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' } as RichNode] }
}

/** True when text uses enough Markdown that converting it is worthwhile. */
export function looksLikeMarkdown(text: string): boolean {
  return /^#{1,6}\s|\*\*[^*]+\*\*|^\s*[-*]\s|^\s*>\s/m.test(text)
}
