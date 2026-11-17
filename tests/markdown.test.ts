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
