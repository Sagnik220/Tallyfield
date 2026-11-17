import Image from "next/image";
import Link from "next/link";
import {
  ArticleBody,
  findVerdict,
  formatDate,
  formatRupees,
  readingMinutes,
} from "@/components/blocks/render";
import { Ornaments, SiteFooter, SiteHeader } from "@/components/site/chrome";
import { titleSize } from "@/components/site/title-size";
import { mediaIdsInBody, type PublicArticle } from "@/data/public.repo";
import { mediaUrl } from "@/lib/media-url";

/** A published article: header in the reading column, the body, then tags and the Instagram link. */
export function ArticleView({ article }: { article: PublicArticle }) {
  const { post, category, tags, media } = article;
  const blocks = post.body.blocks;
  const cover = post.cover_media_id ? media[post.cover_media_id] : undefined;
  // The cover is shown at the top only when the article doesn't already show that picture.
  const showCover =
    Boolean(cover) && !mediaIdsInBody(post.body).includes(post.cover_media_id!);
  const minutes = readingMinutes(blocks);
  const verdict = findVerdict(blocks);
  const published = post.published_at ? formatDate(post.published_at) : null;

  return (
    <div className="tf-page">
      <Ornaments />
      <SiteHeader />

      <main>
        <article>
          <header className="tf-read tf-article-head">
            <div className="tf-eyebrow">
              {category ? (
                <Link
                  href={`/archive?category=${category.slug}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {category.name}
                </Link>
              ) : null}
            </div>
            <h1
              className="tf-display"
              style={{ fontSize: titleSize(post.title, "read") }}
            >
              {post.title}
            </h1>
            {post.deck ? <p className="tf-article-deck">{post.deck}</p> : null}
            <div className="tf-article-meta">
              <span className="tf-article-by">Tallyfield</span>
              <span aria-hidden="true">·</span>
              <span>{minutes} min read</span>
              {published ? (
                <>
                  <span aria-hidden="true">·</span>
                  <time dateTime={post.published_at ?? undefined}>
                    {published}
                  </time>
                </>
              ) : null}
            </div>
            {post.prices_checked_on ? (
              <p className="tf-note" style={{ margin: 0 }}>
                Prices checked {formatDate(post.prices_checked_on)}
                {post.price_sources ? ` · ${post.price_sources}` : ""}
              </p>
            ) : null}
          </header>

          {showCover && cover ? (
            <div className="tf-read">
              <figure className="tf-figure" data-size="wide">
                <Image
                  src={mediaUrl(cover.storage_path)}
                  alt={cover.alt}
                  width={cover.width ?? 1600}
                  height={cover.height ?? 1000}
                  priority
                  sizes="(max-width: 1080px) 100vw, 1040px"
                  style={{ width: "100%", height: "auto" }}
                />
              </figure>
            </div>
          ) : null}

          {verdict ? (
            <section className="tf-read" style={{ paddingBottom: 8 }}>
              <a
                className="tf-cta tf-reveal"
                href="#verdict"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  gap: "16px 40px",
                  padding: "22px clamp(18px, 3vw, 28px)",
                  background: "var(--panel-hi)",
                  border: "2px solid var(--gold)",
                  color: "var(--ink-cream)",
                  textTransform: "none",
                  letterSpacing: 0,
                }}
              >
                <span
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <span className="tf-label">{verdict.eyebrow}</span>
                  <span
                    style={{
                      fontSize: "clamp(20px, 2.2vw, 30px)",
                      fontWeight: 700,
                    }}
                  >
                    {verdict.pick}
                    {verdict.priceInr
                      ? ` · ${formatRupees(verdict.priceInr)}`
                      : ""}
                  </span>
                </span>
                <span className="tf-label">Jump to the verdict ↓</span>
              </a>
            </section>
          ) : null}

          <ArticleBody body={blocks} media={media} />

          <footer className="tf-read">
            <div className="tf-article-foot">
              {tags.length > 0 ? (
                <div
                  aria-label="Tags"
                  style={{ display: "flex", flexWrap: "wrap", gap: 10 }}
                >
                  {tags.map((t) => (
                    <Link
                      key={t.slug}
                      className="tf-tag"
                      href={`/archive?tag=${t.slug}`}
                    >
                      {t.name}
                    </Link>
                  ))}
                </div>
              ) : null}
              {post.source_url ? (
                <a
                  className="tf-nav"
                  href={post.source_url}
                  style={{ color: "var(--gold-light)" }}
                >
                  See the original post on Instagram →
                </a>
              ) : null}
            </div>
          </footer>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
