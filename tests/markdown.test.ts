import { describe, expect, it } from 'vitest'
import { markdownToRichDoc, richDoc } from '@/blocks'

const caption = `# Timex René Tank: A Touch of Classic Elegance

*Some watches don't need complicated movements to make a statement.*

## The Return of a Classic Silhouette

The **Timex René Tank** draws inspiration from this design.
It isn't trying to reinvent the dress watch: **simplicity never goes out of style.**

- Reliable everyday timekeeping.
- Minimal maintenance requirements.

> A quiet watch.

---

1. First
2. Second

Read [the review](https://example.com/r) now.

#timex #watches #tallyfield`

describe('markdownToRichDoc', () => {
  const doc = markdownToRichDoc(caption)
  const types = doc.content.map((n) => n.type)

  it('builds a valid rich text document', () => {
    expect(richDoc.safeParse(doc).success).toBe(true)
  })
  it('maps headings relative to the top level (# → h2, ## → h3)', () => {
    const headings = doc.content.filter((n) => n.type === 'heading') as { attrs: { level: number }; content: { text: string }[] }[]
    expect(headings.map((h) => h.attrs.level)).toEqual([2, 3])
    expect(headings[0]!.content[0]!.text).toBe('Timex René Tank: A Touch of Classic Elegance')
  })
  it('turns *x* into italic and **x** into bold, keeping line breaks', () => {
    const italic = doc.content[1] as { content: { text: string; marks?: { type: string }[] }[] }
    expect(italic.content[0]!.marks).toEqual([{ type: 'italic' }])
    const p = doc.content[3] as { content: { type: string; text?: string; marks?: { type: string }[] }[] }
    expect(p.content.find((n) => n.text === 'Timex René Tank')?.marks).toEqual([{ type: 'bold' }])
    expect(p.content.some((n) => n.type === 'hardBreak')).toBe(true)
  })
  it('recognises lists, quotes, dividers and links, and drops hashtag lines', () => {
    expect(types).toEqual(['heading', 'paragraph', 'heading', 'paragraph', 'bulletList', 'blockquote', 'horizontalRule', 'orderedList', 'paragraph'])
    const last = doc.content.at(-1) as { content: { text: string; marks?: { type: string; attrs?: { href: string } }[] }[] }
    expect(last.content[1]!.marks?.[0]).toEqual({ type: 'link', attrs: { href: 'https://example.com/r' } })
    expect(JSON.stringify(doc)).not.toContain('#timex')
  })
  it('leaves lone asterisks and snake_case words alone', () => {
    const d = markdownToRichDoc('Price 2 * 3 and file_name_here')
    expect(JSON.stringify(d)).not.toContain('italic')
  })
  it('never produces links that are not https', () => {
    const d = markdownToRichDoc('[x](javascript:alert(1))')
    expect(JSON.stringify(d)).not.toContain('"link"')
  })
})

describe('markdown tables', () => {
  const md = `## Specifications at a Glance

| Specification | Details |
|---|---|
| Brand | Timex |
| Collection | René Tank |
| Movement | **Quartz** |
| Strap | Leather \\| croc-grain |

After the table.`
  const doc = markdownToRichDoc(md)
  const table = doc.content.find((n) => n.type === 'table') as unknown as { content: { content: { type: string; content: { content?: { text: string; marks?: unknown[] }[] }[] }[] }[] }

  it('turns pipe rows into a valid table with a header row', () => {
    expect(richDoc.safeParse(doc).success).toBe(true)
    expect(doc.content.map((n) => n.type)).toEqual(['heading', 'table', 'paragraph'])
    expect(table.content).toHaveLength(5)
    expect(table.content[0]!.content.map((c) => c.type)).toEqual(['tableHeader', 'tableHeader'])
    expect(table.content[1]!.content[1]!.content[0]!.content![0]!.text).toBe('Timex')
  })
  it('keeps formatting and escaped pipes inside cells', () => {
    expect(table.content[3]!.content[1]!.content[0]!.content![0]!.marks).toEqual([{ type: 'bold' }])
    expect(table.content[4]!.content[1]!.content[0]!.content![0]!.text).toBe('Leather | croc-grain')
  })
  it('handles comparison tables with more columns and ragged rows', () => {
    const d = markdownToRichDoc('| | Rolex | Seiko | Timex |\n|:--|:-:|:-:|--:|\n| Price | ₹11L | ₹40k |\n| Movement | Auto | Auto | Quartz |')
    expect(richDoc.safeParse(d).success).toBe(true)
    const t = d.content[0] as unknown as { content: { content: unknown[] }[] }
    expect(t.content.every((r) => r.content.length === 4)).toBe(true)
  })
  it('does not mistake a divider under a normal line for a table', () => {
    expect(markdownToRichDoc('Hello there\n---\nMore').content.some((n) => n.type === 'table')).toBe(false)
  })
})
