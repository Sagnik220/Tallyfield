import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { blocks, bodySchema, BlockRegistry } from '@/blocks'

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`

describe('block registry', () => {
  it('accepts a body made of known, well-formed blocks', () => {
    const result = bodySchema.safeParse({
      version: 1,
      blocks: [
        { id: id(1), type: 'heading', data: { text: 'I paid 33K for mine' } },
        { id: id(2), type: 'verdict', data: { pick: 'NJ0151-88M', priceInr: 41900, reasons: ['Automatic for the least'], drawback: '40 h and 50 m.' } },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.blocks[0]?.data).toEqual({ text: 'I paid 33K for mine', level: 2 })
  })

  it('rejects unknown block types', () => {
    const result = bodySchema.safeParse({ version: 1, blocks: [{ id: id(1), type: 'raw_html', data: { html: '<script>alert(1)</script>' } }] })
    expect(result.success).toBe(false)
  })

  it('rejects a verdict without a drawback (house rule)', () => {
    const result = bodySchema.safeParse({ version: 1, blocks: [{ id: id(1), type: 'verdict', data: { pick: 'X', reasons: ['Y'] } }] })
    expect(result.success).toBe(false)
  })

  it('rejects a price table without a source and date (house rule)', () => {
    const result = bodySchema.safeParse({ version: 1, blocks: [{ id: id(1), type: 'price_table', data: { rows: [{ model: 'PRX', priceInr: 44000 }] } }] })
    expect(result.success).toBe(false)
  })

  it('rejects a spec table whose rows do not match its columns', () => {
    const data = { columns: ['A', 'B'], rows: [{ label: 'Reserve', values: ['40 h'] }] }
    expect(bodySchema.safeParse({ version: 1, blocks: [{ id: id(1), type: 'spec_table', data }] }).success).toBe(false)
  })

  it('rejects Instagram embeds that are not instagram.com post links', () => {
    const bad = { version: 1, blocks: [{ id: id(1), type: 'instagram_embed', data: { permalink: 'https://evil.example/p/abcdef/' } }] }
    expect(bodySchema.safeParse(bad).success).toBe(false)
  })

  it('rejects duplicate block ids and unsupported versions', () => {
    const block = { id: id(1), type: 'text', data: { text: 'a' } }
    expect(bodySchema.safeParse({ version: 1, blocks: [block, block] }).success).toBe(false)
    expect(bodySchema.safeParse({ version: 2, blocks: [] }).success).toBe(false)
  })

  it('gives every block a valid empty state and plain text', () => {
    for (const def of blocks.list()) {
      const parsed = def.schema.safeParse(def.empty())
      expect(parsed.success, def.type).toBe(true)
      if (parsed.success) expect(typeof def.toPlainText(parsed.data)).toBe('string')
    }
  })

  it('lets a new block be added without touching existing code', () => {
    const registry = new BlockRegistry().register({
      type: 'pull_quote',
      label: 'Pull quote',
      schema: z.object({ quote: z.string().min(1) }),
      empty: () => ({ quote: 'Quote' }),
      toPlainText: (d) => (d as { quote: string }).quote,
    })
    expect(registry.bodySchema().safeParse({ version: 1, blocks: [{ id: id(1), type: 'pull_quote', data: { quote: 'Hi' } }] }).success).toBe(true)
    expect(() => registry.register({ ...registry.get('pull_quote')! })).toThrow()
  })
})

describe('rich text block', () => {
  const uuid = '00000000-0000-4000-8000-000000000009'
  const block = (doc: unknown) => ({ version: 1, blocks: [{ id: uuid, type: 'rich_text', data: { doc } }] })

  it('accepts styled text, lists, media and embeds', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Which Santos?' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Big ', marks: [{ type: 'textStyle', attrs: { fontSize: '28px', color: '#C8A86B' } }, { type: 'bold' }] },
            { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://www.cartier.com/' } }] },
            { type: 'text', text: ' 😍' },
          ],
        },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }] }] },
        { type: 'media', attrs: { mediaId: uuid, path: `upload/${uuid}.gif`, kind: 'image', alt: 'A GIF' } },
        { type: 'embed', attrs: { provider: 'youtube', id: 'dQw4w9WgXcQ' } },
      ],
    }
    expect(bodySchema.safeParse(block(doc)).success).toBe(true)
  })

  it('rejects javascript links, unknown nodes and off-palette styles', () => {
    const bad = (content: unknown[]) => bodySchema.safeParse(block({ type: 'doc', content })).success
    expect(bad([{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }])).toBe(false)
    expect(bad([{ type: 'iframe', attrs: { src: 'https://evil.example' } }])).toBe(false)
    expect(bad([{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'textStyle', attrs: { fontSize: '200px' } }] }] }])).toBe(false)
    expect(bad([{ type: 'media', attrs: { mediaId: uuid, path: '../../etc/passwd', kind: 'image' } }])).toBe(false)
  })
})

describe('rich text sanitiser', () => {
  it('keeps the words and drops styles that are not allowed', async () => {
    const { sanitizeRichDoc } = await import('@/blocks')
    const pasted = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello', marks: [{ type: 'textStyle', attrs: { fontSize: '13.33px', color: 'rgb(1,2,3)' } }, { type: 'bold' }] }] },
        { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cell' }] }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
      ],
    }
    const clean = sanitizeRichDoc(pasted)
    expect(clean.content[0]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'Hello', marks: [{ type: 'bold' }] }] })
    expect(JSON.stringify(clean)).toContain('cell')
    expect(JSON.stringify(clean)).not.toContain('javascript')
    expect(clean.content.at(-1)).toMatchObject({ type: 'heading', attrs: { level: 2 } })
    const uuid = '00000000-0000-4000-8000-000000000009'
    expect(bodySchema.safeParse({ version: 1, blocks: [{ id: uuid, type: 'rich_text', data: { doc: clean } }] }).success).toBe(true)
  })
})
