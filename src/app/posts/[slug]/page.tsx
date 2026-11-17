import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { ArticleBody, findVerdict, formatDate, formatRupees } from '@/components/blocks/render'
import { Ornaments, SiteFooter, SiteHeader } from '@/components/site/chrome'
import { getPublicArticle, type PublicArticle } from '@/data/public.repo'
import { SLUG_PATTERN } from '@/domain/slug'
import { mediaUrl } from '@/lib/media-url'
import { safely } from '@/lib/safely'
import { createPublicClient } from '@/lib/supabase/public'

// Pages are built on first visit, cached, and rebuilt when the post is edited or every 5 minutes.
export const revalidate = 300
export function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ slug: string }> }

const load = cache(async (slug: string): Promise<PublicArticle | null> => {
  if (!SLUG_PATTERN.test(slug) || slug.length > 120) return null
  return safely('article', () => getPublicArticle(createPublicClient(), slug), null)
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await load((await params).slug)
  if (!article) return { title: 'Not found' }
  const { post, media } = article
  const cover = post.cover_media_id ? media[post.cover_media_id] : undefined
  return {
    title: post.title,
    description: post.deck || undefined,
    alternates: { canonical: `/posts/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.deck || undefined,
      publishedTime: post.published_at ?? undefined,
      images: cover ? [{ url: mediaUrl(cover.storage_path), alt: cover.alt }] : undefined,
    },
  }
}

export default async function PostPage({ params }: Props) {
  const article = await load((await params).slug)
  if (!article) notFound()
  const { post, category, tags, media } = article
  const blocks = post.body.blocks
  const cover = post.cover_media_id ? media[post.cover_media_id] : undefined
  // Imported galleries already open with the cover slide, so the big cover photo is skipped for them.
  const showCover = Boolean(cover) && blocks[0]?.type !== 'gallery'
  const verdict = findVerdict(blocks)
  const published = post.published_at ? formatDate(post.published_at) : null

  return (
    <div className="tf-page">
      <Ornaments />
      <SiteHeader />

      <main>
        <article>
          <section className="tf-wrap" style={{ paddingTop: 80, paddingBottom: 56, display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div className="tf-eyebrow">
              {category ? (
                <Link href={`/archive?category=${category.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {category.name}
                </Link>
              ) : null}
              {published ? ` · ${published}` : null}
            </div>
            <h1 className="tf-display tf-h1">{post.title}</h1>
            <div className="tf-rule-line tf-rule-anim" />
            {post.deck ? (
              <p className="tf-lead" style={{ maxWidth: 720 }}>
                {post.deck}
              </p>
            ) : null}
            {post.prices_checked_on ? (
              <p className="tf-note">
                Prices checked {formatDate(post.prices_checked_on)}
                {post.price_sources ? ` · ${post.price_sources}` : ''}
              </p>
            ) : null}
            {tags.length > 0 ? (
              <div aria-label="Tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {tags.map((t) => (
                  <Link key={t.slug} className="tf-tag" href={`/archive?tag=${t.slug}`}>
                    {t.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>

          {showCover && cover ? (
            <figure style={{ margin: 0, position: 'relative', width: '100%', height: 'clamp(320px, 46vw, 660px)' }}>
              <Image src={mediaUrl(cover.storage_path)} alt={cover.alt} fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
            </figure>
          ) : null}

          {verdict ? (
            <section className="tf-wrap" style={{ paddingTop: 72, paddingBottom: 72 }}>
              <a
                className="tf-cta tf-reveal"
                href="#verdict"
                style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '16px 40px', padding: '28px 32px', background: 'var(--panel-hi)', border: '2px solid var(--gold)', color: 'var(--ink-cream)', textTransform: 'none', letterSpacing: 0 }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="tf-label">{verdict.eyebrow}</span>
                  <span style={{ fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 700 }}>
                    {verdict.pick}
                    {verdict.priceInr ? ` · ${formatRupees(verdict.priceInr)}` : ''}
                  </span>
                </span>
                <span className="tf-label">Jump to the verdict ↓</span>
              </a>
            </section>
          ) : null}

          <ArticleBody body={blocks} media={media} />

          {post.source_url ? (
            <section className="tf-wrap" style={{ paddingTop: 24 }}>
              <a className="tf-nav" href={post.source_url} style={{ color: 'var(--gold-light)' }}>
                See the original post on Instagram →
              </a>
            </section>
          ) : null}
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}
