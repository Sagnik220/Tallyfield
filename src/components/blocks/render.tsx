import Image from 'next/image'
import type { ReactNode } from 'react'
import { blocks, markdownToRichDoc, type RichNode, type StoredBlock } from '@/blocks'
import type { MediaRow } from '@/data/types'
import { mediaUrl } from '@/lib/media-url'
import { RichText } from './rich-text'

/**
 * Turns a post body into a magazine reading layout: one centred column for text (like Medium), images at
 * text width, wide or full width, slides stacked downward, and wide blocks (tables, the verdict) breaking out.
 * Caption-style Markdown (# headings, **bold**, - lists) in captions and plain text blocks is shown formatted.
 */

type Media = Record<string, MediaRow>
type Block = { id: string; type: string; data: Record<string, unknown> }

const rupees = (n: number) => '₹' + n.toLocaleString('en-IN')
const date = (iso: string) => new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : '')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })

/** Only blocks that pass their schema are rendered; anything malformed is skipped rather than crashing the page. */
function parse(block: StoredBlock): Block | null {
  const def = blocks.get(block.type)
  const parsed = def?.schema.safeParse(block.data)
  return parsed?.success ? { id: block.id, type: block.type, data: parsed.data as Record<string, unknown> } : null
}

/** Plain text with caption-style Markdown, shown with the same typography as rich text. */
function Prose({ text, dropCap = false }: { text: string; dropCap?: boolean }) {
  if (!text.trim()) return null
  return <RichText doc={markdownToRichDoc(text) as { content: RichNode[] }} dropCap={dropCap} />
}

function Picture({ media, caption, priority = false, size = 'column' }: { media: MediaRow | undefined; caption?: string; priority?: boolean; size?: 'column' | 'wide' | 'full' }) {
  if (!media) return null
  return (
    <figure className="tf-figure" data-size={size}>
      <Image
        src={mediaUrl(media.storage_path)}
        alt={media.alt}
        width={media.width ?? 1080}
        height={media.height ?? 1350}
        priority={priority}
        sizes={size === 'full' ? '100vw' : size === 'wide' ? '(max-width: 1080px) 100vw, 1040px' : '(max-width: 740px) 100vw, 700px'}
        style={{ width: '100%', height: 'auto' }}
      />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}

/** Imported slides, stacked downward in the reading column, followed by the caption. */
function Gallery({ data, media, first, dropCap }: { data: Block['data']; media: Media; first: boolean; dropCap: boolean }) {
  const ids = (data.mediaIds as string[]).filter((id) => media[id])
  return (
    <>
      <div className="tf-slides">
        {ids.map((id, i) => (
          <Picture key={id} media={media[id]} priority={first && i === 0} />
        ))}
      </div>
      <Prose text={String(data.caption ?? '')} dropCap={dropCap} />
    </>
  )
}

function SpecTable({ data }: { data: Block['data'] }) {
  const columns = data.columns as string[]
  const rows = data.rows as { label: string; values: string[] }[]
  return (
    <>
      <div className="tf-table-wrap tf-reveal">
        <table className="tf-table">
          <thead>
            <tr>
              <th scope="col" />
              {columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="tf-rowlabel">{r.label}</td>
                {r.values.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.note ? <p className="tf-note">{String(data.note)}</p> : null}
    </>
  )
}

function PriceTable({ data }: { data: Block['data'] }) {
  const rows = data.rows as { model: string; priceInr: number; movement: string; note: string }[]
  return (
    <>
      <div className="tf-table-wrap tf-reveal">
        <table className="tf-table" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">India price</th>
              <th scope="col">Movement</th>
              <th scope="col">Value note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="tf-strong">{r.model}</td>
                <td className="tf-price">{rupees(r.priceInr)}</td>
                <td>{r.movement}</td>
                <td>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tf-note">
        India prices: {String(data.source)}. Checked {date(String(data.checkedOn))}.
      </p>
    </>
  )
}

function Verdict({ data, media }: { data: Block['data']; media: Media }) {
  const reasons = data.reasons as string[]
  const runnerUp = data.runnerUp as { name: string; line: string } | null
  const picture = data.mediaId ? media[data.mediaId as string] : undefined
  const price = typeof data.priceInr === 'number' ? ` · ${rupees(data.priceInr)}` : ''
  return (
    <section id="verdict" className="tf-bleed" style={{ background: 'var(--panel)', borderTop: '1px solid var(--stroke)', borderBottom: '1px solid var(--stroke)', padding: 'var(--sp-section) 0' }}>
      <div className="tf-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="tf-eyebrow">{String(data.eyebrow)}</div>
        <h2 className="tf-display tf-reveal" style={{ fontSize: 'var(--t-h2)' }}>
          {String(data.pick)}
        </h2>
        <div className="tf-split" style={{ marginTop: 40 }}>
          {picture ? (
            <div className="tf-stage tf-reveal" style={{ display: 'flex', justifyContent: 'center' }}>
              <Image className="tf-tilt tf-float" src={mediaUrl(picture.storage_path)} alt={picture.alt} width={picture.width ?? 1080} height={picture.height ?? 1080} sizes="380px" style={{ width: 'min(380px, 90%)', height: 'auto' }} />
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontSize: 'clamp(22px, 2.4vw, 32px)', fontWeight: 700, color: 'var(--ink-cream)' }}>
              {String(data.pick)}
              {price}
            </div>
            {data.summary ? <p className="tf-body">{String(data.summary)}</p> : null}
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {reasons.map((r, i) => (
                <li key={i} style={{ fontSize: 'var(--t-lead)', lineHeight: 1.45, color: 'var(--ink-cream)' }}>
                  ✓&nbsp;&nbsp;{r}
                </li>
              ))}
              <li style={{ fontSize: 'var(--t-lead)', lineHeight: 1.45, color: 'var(--warn)' }}>✕&nbsp;&nbsp;Drawback: {String(data.drawback)}</li>
            </ul>
            {runnerUp ? (
              <div style={{ marginTop: 20, background: 'var(--bg)', border: '1px solid var(--stroke)', padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="tf-label">Runner-up</div>
                <div style={{ fontSize: 'clamp(18px, 1.8vw, 22px)', fontWeight: 700, color: 'var(--ink-cream)' }}>{runnerUp.name}</div>
                {runnerUp.line ? <p className="tf-body">{runnerUp.line}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function InstagramEmbed({ data }: { data: Block['data'] }) {
  const src = `${String(data.permalink)}embed/`
  return (
    <div className="tf-reveal" style={{ display: 'flex', justifyContent: 'center' }}>
      <iframe src={src} title="Instagram post" loading="lazy" style={{ width: 'min(540px, 100%)', height: 720, border: '1px solid var(--stroke)', background: '#fff' }} />
    </div>
  )
}

/** Renders one block in the reading column. */
function Inline({ block, media, index, dropCap }: { block: Block; media: Media; index: number; dropCap: boolean }): ReactNode {
  const d = block.data
  switch (block.type) {
    case 'heading':
      return (
        <div className="tf-rich">
          {d.level === 3 ? <h3 className="tf-rich-h3">{String(d.text)}</h3> : <h2 className="tf-display tf-rich-h2">{String(d.text)}</h2>}
        </div>
      )
    case 'text':
      return <Prose text={String(d.text)} dropCap={dropCap} />
    case 'image':
      return <Picture media={media[d.mediaId as string]} caption={String(d.caption ?? '')} priority={index === 0} />
    case 'gallery':
      return <Gallery data={d} media={media} first={index === 0} dropCap={dropCap} />
    case 'spec_table':
      return (
        <div className="tf-wide">
          <SpecTable data={d} />
        </div>
      )
    case 'price_table':
      return (
        <div className="tf-wide">
          <PriceTable data={d} />
        </div>
      )
    case 'verdict':
      return <Verdict data={d} media={media} />
    case 'instagram_embed':
      return <InstagramEmbed data={d} />
    case 'rich_text':
      return <RichText doc={d.doc as { content: RichNode[] }} dropCap={dropCap} />
    default:
      return null
  }
}

/** Blocks whose text can open the article with a drop cap. */
const PROSE = new Set(['text', 'rich_text', 'gallery'])

export function ArticleBody({ body, media }: { body: StoredBlock[]; media: Media }) {
  const parsed = body.map(parse).filter((b): b is Block => b !== null)
  const firstProse = parsed.findIndex((b) => PROSE.has(b.type))
  return (
    <div className="tf-read tf-article-body">
      {parsed.map((b, i) => (
        <Inline key={b.id} block={b} media={media} index={i} dropCap={i === firstProse} />
      ))}
    </div>
  )
}

/** Words in the body, for "6 min read". */
export function readingMinutes(body: StoredBlock[]): number {
  const words = body
    .map((b) => {
      const def = blocks.get(b.type)
      const p = def?.schema.safeParse(b.data)
      return p?.success ? def!.toPlainText(p.data as never) : ''
    })
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(words / 230))
}

/** The verdict block, if the post has one: used for the "jump to the verdict" card at the top. */
export function findVerdict(body: StoredBlock[]): { eyebrow: string; pick: string; priceInr: number | null } | null {
  for (const b of body) {
    const p = parse(b)
    if (p?.type === 'verdict') return { eyebrow: String(p.data.eyebrow), pick: String(p.data.pick), priceInr: (p.data.priceInr as number | null) ?? null }
  }
  return null
}

export { date as formatDate, rupees as formatRupees }
