import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Ornaments, SiteFooter, SiteHeader } from '@/components/site/chrome'
import { titleSize } from '@/components/site/title-size'
import { listCategories, listTags, type CategoryRow, type TagRow } from '@/data/public.repo'
import { searchPosts } from '@/data/search.repo'
import { searchParamsSchema, type PostSummary } from '@/domain/post'
import { mediaUrl } from '@/lib/media-url'
import { safely } from '@/lib/safely'
import { createPublicClient } from '@/lib/supabase/public'

export const metadata: Metadata = { title: 'Archive', description: 'Every Tallyfield comparison, verdict and buying guide. Search by watch, brand or price.' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

function hrefWith(base: { q: string; category?: string | undefined; tags: string[] }, change: { category?: string | null; toggleTag?: string }) {
  const params = new URLSearchParams()
  if (base.q) params.set('q', base.q)
  const category = change.category === null ? undefined : (change.category ?? base.category)
  if (category) params.set('category', category)
  let tags = base.tags
  if (change.toggleTag) tags = tags.includes(change.toggleTag) ? tags.filter((t) => t !== change.toggleTag) : [...tags, change.toggleTag]
  for (const t of tags) params.append('tag', t)
  const qs = params.toString()
  return qs ? `/archive?${qs}` : '/archive'
}

export default async function ArchivePage({ searchParams }: Props) {
  const raw = await searchParams
  const parsed = searchParamsSchema.safeParse({
    q: typeof raw.q === 'string' ? raw.q : undefined,
    category: typeof raw.category === 'string' && raw.category ? raw.category : undefined,
    tags: raw.tag === undefined ? [] : Array.isArray(raw.tag) ? raw.tag : [raw.tag],
    page: typeof raw.page === 'string' ? raw.page : undefined,
  })
  const params = parsed.success ? parsed.data : { q: '', tags: [], page: 1, category: undefined }
  const db = createPublicClient()
  const [results, categories, tags] = await Promise.all([
    safely('archive.search', () => searchPosts(db, params), [] as PostSummary[]),
    safely('archive.categories', () => listCategories(db), [] as CategoryRow[]),
    safely('archive.tags', () => listTags(db), [] as TagRow[]),
  ])
  const filtered = Boolean(params.q || params.category || params.tags.length)

  return (
    <div className="tf-page">
      <Ornaments />
      <SiteHeader />
      <main>
        <section className="tf-wrap" style={{ paddingTop: 'var(--sp-top)', paddingBottom: 40, display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div className="tf-eyebrow">The archive</div>
          <h1 className="tf-display tf-h1">Every verdict.</h1>
          <div className="tf-rule-line tf-rule-anim" />
          <form action="/archive" role="search" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, maxWidth: 820 }}>
            <label htmlFor="q" className="tf-label" style={{ position: 'absolute', left: -9999 }}>
              Search
            </label>
            <input id="q" name="q" type="search" defaultValue={params.q} placeholder="Search a watch, brand or price…" className="tf-field" style={{ flex: '999 1 260px', minHeight: 50, fontSize: 'var(--t-body)' }} />
            {params.category ? <input type="hidden" name="category" value={params.category} /> : null}
            {params.tags.map((t) => (
              <input key={t} type="hidden" name="tag" value={t} />
            ))}
            <button type="submit" className="tf-cta" style={{ minHeight: 50 }}>
              Search
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div aria-label="Categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Link className="tf-tag" href={hrefWith(params, { category: null })} aria-current={!params.category ? 'true' : undefined} style={!params.category ? { borderColor: 'var(--gold)', color: 'var(--ink-cream)', background: 'var(--panel-hi)' } : undefined}>
                All
              </Link>
              {categories.map((c) => {
                const on = params.category === c.slug
                return (
                  <Link key={c.slug} className="tf-tag" href={hrefWith(params, { category: on ? null : c.slug })} aria-current={on ? 'true' : undefined} style={on ? { borderColor: 'var(--gold)', color: 'var(--ink-cream)', background: 'var(--panel-hi)' } : undefined}>
                    {c.name}
                  </Link>
                )
              })}
            </div>
            {tags.length > 0 ? (
              <div aria-label="Tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tags.map((t) => {
                  const on = params.tags.includes(t.slug)
                  return (
                    <Link key={t.slug} className="tf-tag" href={hrefWith(params, { toggleTag: t.slug })} aria-pressed={on} style={{ minHeight: 34, fontSize: 13, ...(on ? { borderColor: 'var(--gold)', color: 'var(--ink-cream)', background: 'var(--panel-hi)' } : {}) }}>
                      {on ? '✓ ' : ''}
                      {t.name}
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>
        </section>

        <section className="tf-section" style={{ paddingTop: 56 }}>
          <div className="tf-wrap">
            <p className="tf-note" aria-live="polite" style={{ marginBottom: 28 }}>
              {results.length === 0 ? (filtered ? 'Nothing matches that yet. Try fewer filters.' : 'The first issues are on their way. Every verdict is on Instagram until then.') : `${results.length} ${results.length === 1 ? 'piece' : 'pieces'}`}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 28 }}>
              {results.map((post) => (
                <Link key={post.id} className="tf-tile tf-reveal" href={`/posts/${post.slug}`}>
                  <span style={{ position: 'relative', display: 'block', aspectRatio: '4 / 5', overflow: 'hidden', background: 'var(--panel)' }}>
                    {post.coverPath ? <Image src={mediaUrl(post.coverPath)} alt={post.coverAlt ?? ''} fill sizes="(max-width: 700px) 100vw, 400px" style={{ objectFit: 'cover' }} /> : null}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '18px 20px 22px' }}>
                    <span className="tf-label">{post.categoryName}</span>
                    <span className="tf-clamp-3" style={{ fontFamily: 'var(--display)', fontSize: titleSize(post.title, 'tile'), lineHeight: 1.04, textTransform: 'uppercase' }}>{post.title}</span>
                    {post.deck ? <span style={{ fontSize: 'var(--t-small)', lineHeight: 1.45, color: 'var(--grey-1)' }}>{post.deck}</span> : null}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
