import Image from 'next/image'
import type { ReactNode } from 'react'
import { blocks, type StoredBlock } from '@/blocks'
import type { MediaRow } from '@/data/types'
import { mediaUrl } from '@/lib/media-url'

/**
 * Turns a post body into the article layout from the design.
 * Each level-2 heading starts a new full-width section. A section that holds one image and some text
 * is laid out as two columns (text left, image right), like the designed article.
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

function Paragraphs({ text, className = 'tf-body' }: { text: string; className?: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className={className} style={{ whiteSpace: 'pre-line', maxWidth: 820 }}>
            {p}
          </p>
        ))}
    </>
  )
}

function Picture({ media, caption, tilt, priority = false }: { media: MediaRow | undefined; caption?: string; tilt?: boolean; priority?: boolean }) {
  if (!media) return null
  const w = media.width ?? 1080
  const h = media.height ?? 1350
  return (
    <figure className="tf-reveal" style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className={tilt ? 'tf-stage' : undefined} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Image className={tilt ? 'tf-tilt' : undefined} src={mediaUrl(media.storage_path)} alt={media.alt} width={w} height={h} priority={priority} sizes="(max-width: 900px) 100vw, 600px" style={{ width: '100%', maxWidth: 600, height: 'auto' }} />
      </div>
      {caption ? <figcaption className="tf-label">{caption}</figcaption> : null}
    </figure>
  )
}

function Gallery({ data, media }: { data: Block['data']; media: Media }) {
  const ids = (data.mediaIds as string[]).filter((id) => media[id])
  const caption = String(data.caption ?? '')
    .split('\n')
    .filter((line) => !/^\s*(#\S+\s*)+$/.test(line)) // drop hashtag-only lines from imported captions
    .join('\n')
    .trim()
  return (
    <section style={{ paddingTop: 16, paddingBottom: 'var(--sp-section)' }}>
      <div className="tf-gallery" role="region" aria-label={`Slides, ${ids.length} images. Scroll sideways for more.`} tabIndex={0}>
        {ids.map((id, i) => {
          const m = media[id]!
          return (
            <figure key={id}>
              <Image src={mediaUrl(m.storage_path)} alt={m.alt} width={m.width ?? 1080} height={m.height ?? 1350} priority={i === 0} sizes="(max-width: 700px) 86vw, 540px" style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid var(--stroke)' }} />
              <figcaption className="tf-note" style={{ paddingTop: 10 }}>
                {String(i + 1).padStart(2, '0')} / {String(ids.length).padStart(2, '0')}
              </figcaption>
            </figure>
          )
        })}
      </div>
      {caption ? (
        <div className="tf-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 40 }}>
          <Paragraphs text={caption} />
        </div>
      ) : null}
    </section>
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
    <section id="verdict" style={{ background: 'var(--panel)', borderTop: '1px solid var(--stroke)', borderBottom: '1px solid var(--stroke)', padding: 'var(--sp-section) 0' }}>
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

/** Renders one block that lives inside a normal section. */
function Inline({ block, media }: { block: Block; media: Media }): ReactNode {
  const d = block.data
  switch (block.type) {
    case 'heading':
      return d.level === 3 ? (
        <h3 className="tf-reveal" style={{ margin: 0, fontSize: 'var(--t-h3)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-cream)' }}>
          {String(d.text)}
        </h3>
      ) : (
        <h2 className="tf-display tf-h2 tf-reveal">{String(d.text)}</h2>
      )
    case 'text':
      return <Paragraphs text={String(d.text)} />
    case 'image':
      return <Picture media={media[d.mediaId as string]} caption={String(d.caption ?? '')} tilt={Boolean(d.tilt)} />
    case 'spec_table':
      return <SpecTable data={d} />
    case 'price_table':
      return <PriceTable data={d} />
    case 'instagram_embed':
      return <InstagramEmbed data={d} />
    default:
      return null
  }
}

/** Blocks that take the full width of the page instead of sitting in a section. */
const FULL_WIDTH = new Set(['gallery', 'verdict'])

export function ArticleBody({ body, media }: { body: StoredBlock[]; media: Media }) {
  const parsed = body.map(parse).filter((b): b is Block => b !== null)

  // Group into runs: each full-width block on its own, everything else split into sections at level-2 headings.
  const groups: { full?: Block; items: Block[] }[] = []
  for (const block of parsed) {
    if (FULL_WIDTH.has(block.type)) {
      groups.push({ full: block, items: [] })
      continue
    }
    const startsSection = block.type === 'heading' && block.data.level !== 3
    const last = groups[groups.length - 1]
    if (!last || last.full || startsSection) groups.push({ items: [block] })
    else last.items.push(block)
  }

  return (
    <>
      {groups.map((group, gi) => {
        if (group.full?.type === 'gallery') return <Gallery key={group.full.id} data={group.full.data} media={media} />
        if (group.full?.type === 'verdict') return <Verdict key={group.full.id} data={group.full.data} media={media} />
        const images = group.items.filter((b) => b.type === 'image')
        const rest = group.items.filter((b) => b.type !== 'image')
        const split = images.length === 1 && rest.length > 0
        return (
          <section key={group.items[0]?.id ?? gi} className="tf-section">
            {split ? (
              <div className="tf-wrap tf-split">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                  {rest.map((b) => (
                    <Inline key={b.id} block={b} media={media} />
                  ))}
                </div>
                <Inline block={images[0]!} media={media} />
              </div>
            ) : (
              <div className="tf-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {group.items.map((b) => (
                  <Inline key={b.id} block={b} media={media} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </>
  )
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
