import Link from 'next/link'
import { site } from '@/config/site'
import { searchPosts } from '@/data/search.repo'
import type { PostSummary } from '@/domain/post'
import { HeroCard } from '@/components/site/hero-card'
import { IssuesCarousel, type Issue } from '@/components/site/issues-carousel'
import { Ornaments, SiteFooter, SiteHeader } from '@/components/site/chrome'
import { titleSize } from '@/components/site/title-size'
import { mediaUrl } from '@/lib/media-url'
import { StoriesRow, type Story } from '@/components/site/stories'
import { listLiveStories, type StoryRow } from '@/data/stories.repo'
import { safely } from '@/lib/safely'
import { createPublicClient } from '@/lib/supabase/public'

// Rebuilt at most every 5 minutes, and immediately when a post is published (see src/server/actions/posts.ts).
export const revalidate = 300

const pad = (n: number) => String(n).padStart(2, '0')

const METHOD = [
  { title: 'India prices', text: 'Every price is in rupees, with the retailer named and the date we checked it.' },
  { title: 'Head to head', text: 'Official specs and official photos, side by side. No imagined capability.' },
  { title: 'One pick, one drawback', text: "Each verdict names the one we'd buy, and the thing about it you should know first." },
]

function toIssue(post: PostSummary): Issue {
  return {
    slug: post.slug,
    title: post.title,
    deck: post.deck,
    label: post.categoryName,
    image: post.coverPath ? mediaUrl(post.coverPath) : null,
    imageAlt: post.coverAlt ?? '',
  }
}

export default async function HomePage() {
  const db = createPublicClient()
  const [posts, storyRows] = await Promise.all([
    safely('home.latest', () => searchPosts(db, { q: '', tags: [], page: 1 }), [] as PostSummary[]),
    safely('home.stories', () => listLiveStories(db), [] as StoryRow[]),
  ])
  const stories: Story[] = storyRows.map((s) => ({
    id: s.id,
    src: mediaUrl(s.media!.storage_path),
    kind: s.media!.mime_type.startsWith('video/') ? 'video' : 'image',
    alt: s.media!.alt,
    caption: s.caption,
    linkUrl: s.link_url,
    linkLabel: s.link_label,
    durationMs: s.duration_ms,
  }))
  const cover = posts[0]
  const issues = posts.slice(0, 5).map(toIssue)
  const latest = posts.slice(0, 6)

  return (
    <div className="tf-page">
      <Ornaments />
      <SiteHeader latestHref={cover ? `/posts/${cover.slug}` : null} />
      <StoriesRow stories={stories} />

      <main>
        <section id="top" className="tf-wrap tf-hero">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="tf-eyebrow">{cover ? `Cover story · ${cover.categoryName}` : 'Watches · Reviews · Buying guides'}</div>
            <h1 className="tf-display" style={{ fontSize: titleSize(cover?.title ?? 'Worth it, or not.', 'hero'), lineHeight: 0.98 }}>
              {cover ? cover.title : 'Worth it, or not.'}
            </h1>
            <div className="tf-rule-line tf-rule-anim" />
            <p className="tf-lead" style={{ maxWidth: 520 }}>
              {cover?.deck || site.tagline}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px 32px' }}>
              {cover ? (
                <Link className="tf-cta" href={`/posts/${cover.slug}`}>
                  Read the verdict <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <a className="tf-cta" href={site.instagram}>
                  Follow on Instagram <span aria-hidden="true">→</span>
                </a>
              )}
              <Link className="tf-nav" href="/archive" style={{ fontSize: 'var(--t-small)' }}>
                All comparisons
              </Link>
            </div>
          </div>
          <HeroCard
            src={cover?.coverPath ? mediaUrl(cover.coverPath) : null}
            alt={cover?.coverAlt ?? ''}
            badge={cover ? '' : 'Coming soon'}
          />
        </section>

        {issues.length > 1 ? (
          <section id="issues" style={{ borderTop: '1px solid var(--rule-dark)', padding: 'var(--sp-section) 0' }}>
            <IssuesCarousel issues={issues} />
          </section>
        ) : null}

        <section id="latest" style={{ borderTop: '1px solid var(--rule-dark)', padding: 'var(--sp-section) 0' }}>
          <div className="tf-wrap">
            <div className="tf-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 36 }}>
              <div className="tf-eyebrow">Latest</div>
              <h2 className="tf-display" style={{ fontSize: 'var(--t-h2)' }}>
                Worth it, or not.
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', borderTop: '2px solid var(--gold)' }}>
              {latest.length > 0 ? (
                latest.map((post, i) => (
                  <Link key={post.id} className="tf-row tf-reveal" href={`/posts/${post.slug}`}>
                    <span style={{ fontSize: 'var(--t-small)', fontWeight: 700, color: 'var(--grey-2)' }}>{pad(i + 1)}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span className="tf-label">{post.categoryName}</span>
                      <span style={{ fontFamily: 'var(--display)', fontSize: titleSize(post.title, 'row'), lineHeight: 1.04, textTransform: 'uppercase' }}>{post.title}</span>
                    </span>
                    <span className="tf-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))
              ) : (
                <a className="tf-row" href={site.instagram}>
                  <span style={{ fontSize: 'var(--t-small)', fontWeight: 700, color: 'var(--grey-2)' }}>01</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span className="tf-label">First issues coming soon</span>
                    <span style={{ fontFamily: 'var(--display)', fontSize: 'clamp(18px, 2.4vw, 34px)', lineHeight: 1.04, textTransform: 'uppercase' }}>
                      Until then, every verdict is on Instagram.
                    </span>
                  </span>
                  <span className="tf-arrow" aria-hidden="true">
                    →
                  </span>
                </a>
              )}
            </div>
          </div>
        </section>

        <section id="method" style={{ background: 'var(--panel)', borderTop: '1px solid var(--stroke)', borderBottom: '1px solid var(--stroke)', padding: 'var(--sp-section) 0' }}>
          <div className="tf-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(32px, 5vw, 56px)' }}>
            <div className="tf-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="tf-eyebrow">How we judge</div>
              <h2 className="tf-display" style={{ fontSize: 'var(--t-h2)' }}>
                Thoughtful comparisons.
                <br />
                Clearer choices.
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '48px 40px' }}>
              {METHOD.map((m, i) => (
                <div key={m.title} className="tf-point tf-reveal">
                  <div>
                    <h3>
                      {pad(i + 1)}&nbsp;&nbsp;{m.title}
                    </h3>
                    <p className="tf-body" style={{ lineHeight: 1.45 }}>
                      {m.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
