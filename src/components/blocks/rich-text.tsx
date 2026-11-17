import Image from 'next/image'
import type { CSSProperties, ReactNode } from 'react'
import type { RichMark, RichNode } from '@/blocks'
import { mediaUrl } from '@/lib/media-url'

/**
 * Renders a rich text document (see src/blocks/definitions/rich-text.ts) as React elements.
 * Only allow-listed nodes and marks reach this point, and nothing is rendered as raw HTML.
 * Writer font sizes are softened into responsive sizes so they also read well on phones.
 */

const FONT_SIZE: Record<string, string> = {
  '14px': '14px',
  '16px': 'clamp(15px, 1.1vw, 16px)',
  '18px': 'clamp(16px, 1.3vw, 18px)',
  '22px': 'clamp(18px, 1.6vw, 22px)',
  '28px': 'clamp(21px, 2vw, 28px)',
  '36px': 'clamp(24px, 2.6vw, 36px)',
  '48px': 'clamp(28px, 3.4vw, 48px)',
}
const FONT_FAMILY: Record<string, string> = { display: 'var(--display)', sans: 'var(--sans)', serif: "Georgia, 'Times New Roman', serif" }

function applyMarks(content: ReactNode, marks: RichMark[] | undefined, key: string): ReactNode {
  if (!marks?.length) return content
  let out = content
  const style: CSSProperties = {}
  for (const m of marks) {
    switch (m.type) {
      case 'bold':
        out = <strong>{out}</strong>
        break
      case 'italic':
        out = <em>{out}</em>
        break
      case 'underline':
        out = <u>{out}</u>
        break
      case 'strike':
        out = <s>{out}</s>
        break
      case 'link': {
        const href = m.attrs.href
        const external = href.startsWith('https://')
        out = (
          <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>
            {out}
          </a>
        )
        break
      }
      case 'highlight':
        style.background = m.attrs?.color ?? '#3A2F1A'
        style.padding = '0 0.15em'
        break
      case 'textStyle':
        if (m.attrs.fontSize) style.fontSize = FONT_SIZE[m.attrs.fontSize]
        if (m.attrs.fontFamily) style.fontFamily = FONT_FAMILY[m.attrs.fontFamily]
        if (m.attrs.color) style.color = m.attrs.color
        if (m.attrs.fontFamily === 'display') {
          style.textTransform = 'uppercase'
          style.letterSpacing = '0.01em'
        }
        break
    }
  }
  return Object.keys(style).length ? (
    <span key={key} style={style}>
      {out}
    </span>
  ) : (
    <span key={key}>{out}</span>
  )
}

function align(attrs: unknown): CSSProperties | undefined {
  const a = (attrs as { textAlign?: string | null } | undefined)?.textAlign
  return a && a !== 'left' ? { textAlign: a as CSSProperties['textAlign'] } : undefined
}

function inline(nodes: unknown[] | undefined, prefix: string): ReactNode[] {
  return (nodes ?? []).map((n, i) => {
    const node = n as { type: string; text?: string; marks?: RichMark[] }
    const key = `${prefix}.${i}`
    if (node.type === 'hardBreak') return <br key={key} />
    return applyMarks(node.text ?? '', node.marks, key)
  })
}

function Media({ attrs }: { attrs: Record<string, unknown> }) {
  const src = mediaUrl(String(attrs.path))
  const caption = String(attrs.caption ?? '')
  const alt = String(attrs.alt ?? '')
  const isGif = String(attrs.path).endsWith('.gif')
  const size = attrs.size === 'wide' || attrs.size === 'full' ? attrs.size : 'column'
  return (
    <figure className="tf-figure" data-size={size}>
      {attrs.kind === 'video' ? (
        <video src={src} controls playsInline preload="metadata" aria-label={alt || caption || 'Video'} />
      ) : (
        <Image
          src={src}
          alt={alt}
          width={Number(attrs.width) || 1200}
          height={Number(attrs.height) || 900}
          sizes={size === 'full' ? '100vw' : size === 'wide' ? '(max-width: 1080px) 100vw, 1040px' : '(max-width: 740px) 100vw, 700px'}
          unoptimized={isGif}
          style={{ width: '100%', height: 'auto' }}
        />
      )}
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}

function Embed({ attrs }: { attrs: { provider: string; id: string } }) {
  if (attrs.provider === 'youtube') {
    return (
      <div className="tf-rich-embed tf-rich-embed-video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${attrs.id}?rel=0`}
          title="YouTube video"
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    )
  }
  return (
    <div className="tf-rich-embed tf-rich-embed-ig">
      <iframe src={`${attrs.id}embed/`} title="Instagram post" loading="lazy" />
    </div>
  )
}

type CellNode = { type: 'tableHeader' | 'tableCell'; attrs?: { colspan?: number; rowspan?: number }; content?: { content?: unknown[] }[] }
type TableNode = { content?: { content?: CellNode[] }[] }

/**
 * Spec sheets and comparisons. A header row becomes column titles; when every body row starts with a header
 * cell or the table has two columns, the first column reads as row labels. Wide tables break out of the column
 * and scroll sideways on phones.
 */
function Table({ node, k }: { node: TableNode; k: string }) {
  const rows = node.content ?? []
  const width = Math.max(0, ...rows.map((r) => (r.content ?? []).reduce((n, c) => n + (c.attrs?.colspan ?? 1), 0)))
  const headIsRow = (rows[0]?.content ?? []).every((c) => c.type === 'tableHeader')
  const head = headIsRow ? rows[0] : undefined
  const body = headIsRow ? rows.slice(1) : rows
  // Row labels: two-column spec sheets, an empty top-left title (comparisons), or a header first column.
  const topLeft = head?.content?.[0]
  const topLeftEmpty = Boolean(topLeft) && (topLeft!.content ?? []).every((p) => !(p.content ?? []).length)
  const labels = width === 2 || topLeftEmpty || body.every((r) => r.content?.[0]?.type === 'tableHeader')
  const cellContent = (c: CellNode, key: string) => (c.content ?? []).map((p, i) => <span key={i} className="tf-cell-line">{inline(p.content, `${key}.${i}`)}</span>)
  const span = (c: CellNode) => ({ ...(c.attrs?.colspan && c.attrs.colspan > 1 ? { colSpan: c.attrs.colspan } : {}), ...(c.attrs?.rowspan && c.attrs.rowspan > 1 ? { rowSpan: c.attrs.rowspan } : {}) })
  return (
    <div className="tf-rich-table" data-wide={width >= 4 ? 'true' : undefined} role="region" aria-label="Table" tabIndex={0}>
      <table data-labels={labels ? 'true' : undefined}>
        {head ? (
          <thead>
            <tr>
              {(head.content ?? []).map((c, i) => (
                <th key={i} scope="col" {...span(c)}>
                  {cellContent(c, `${k}.h.${i}`)}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri}>
              {(r.content ?? []).map((c, ci) => {
                const key = `${k}.${ri}.${ci}`
                return c.type === 'tableHeader' || (labels && ci === 0) ? (
                  <th key={ci} scope="row" {...span(c)}>
                    {cellContent(c, key)}
                  </th>
                ) : (
                  <td key={ci} {...span(c)}>
                    {cellContent(c, key)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {width >= 4 ? (
        <p className="tf-rich-table-hint" aria-hidden="true">
          Swipe to see every column →
        </p>
      ) : null}
    </div>
  )
}

function block(n: RichNode, key: string, dropCap = false, standfirst = false): ReactNode {
  const node = n as { type: string; attrs?: Record<string, unknown>; content?: RichNode[] }
  switch (node.type) {
    case 'paragraph': {
      const children = inline(node.content, key)
      return (
        <p key={key} className={standfirst ? 'tf-standfirst' : dropCap ? 'tf-dropcap' : undefined} style={align(node.attrs)}>
          {children.length ? children : <br />}
        </p>
      )
    }
    case 'heading': {
      const level = Number(node.attrs?.level ?? 2)
      const children = inline(node.content, key)
      if (level === 2)
        return (
          <h2 key={key} className="tf-display tf-rich-h2" style={align(node.attrs)}>
            {children}
          </h2>
        )
      if (level === 3)
        return (
          <h3 key={key} className="tf-rich-h3" style={align(node.attrs)}>
            {children}
          </h3>
        )
      return (
        <h4 key={key} className="tf-rich-h4" style={align(node.attrs)}>
          {children}
        </h4>
      )
    }
    case 'bulletList':
      return <ul key={key}>{(node.content ?? []).map((c, i) => block(c, `${key}.${i}`))}</ul>
    case 'orderedList':
      return <ol key={key}>{(node.content ?? []).map((c, i) => block(c, `${key}.${i}`))}</ol>
    case 'listItem':
      return <li key={key}>{(node.content ?? []).map((c, i) => block(c, `${key}.${i}`))}</li>
    case 'blockquote':
      return <blockquote key={key}>{(node.content ?? []).map((c, i) => block(c, `${key}.${i}`))}</blockquote>
    case 'horizontalRule':
      return <hr key={key} />
    case 'table':
      return <Table key={key} node={node as TableNode} k={key} />
    case 'media':
      return <Media key={key} attrs={node.attrs ?? {}} />
    case 'embed':
      return <Embed key={key} attrs={node.attrs as { provider: string; id: string }} />
    default:
      return null
  }
}

function textOf(n: RichNode): string {
  const node = n as { text?: string; content?: RichNode[] }
  return node.text ?? (node.content ?? []).map(textOf).join('')
}

/**
 * dropCap: give the article's opening paragraph a large first letter, magazine style.
 * It goes on the first real paragraph (a sentence or more, starting with a letter) near the top.
 */
function allItalic(n: RichNode): boolean {
  const parts = ((n as { content?: { type: string; text?: string; marks?: { type: string }[] }[] }).content ?? []).filter((c) => c.type === 'text' && c.text?.trim())
  return parts.length > 0 && parts.every((c) => c.marks?.some((m) => m.type === 'italic'))
}

export function RichText({ doc, dropCap = false }: { doc: { content: RichNode[] }; dropCap?: boolean }) {
  // An all-italic paragraph at the very top reads as a standfirst (the magazine intro line).
  const standAt = dropCap ? doc.content.slice(0, 3).findIndex((n) => n.type === 'paragraph' && allItalic(n)) : -1
  // Only the opening: never after a table or a second heading.
  const stopAt = doc.content.findIndex((n, i) => n.type === 'table' || (n.type === 'heading' && doc.content.slice(0, i).some((m) => m.type === 'heading')))
  const capAt = dropCap
    ? doc.content.findIndex((n, i) => i < 5 && (stopAt === -1 || i < stopAt) && i !== standAt && n.type === 'paragraph' && !allItalic(n) && textOf(n).length >= 80 && /^[\p{L}"“‘']/u.test(textOf(n)) && !/center|right/.test((n as { attrs?: { textAlign?: string } }).attrs?.textAlign ?? ''))
    : -1
  return <div className="tf-rich">{doc.content.map((n, i) => block(n, String(i), i === capAt, i === standAt))}</div>
}
