import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArticleView } from "@/components/site/article-view";
import { getPublicArticle, type PublicArticle } from "@/data/public.repo";
import { SLUG_PATTERN } from "@/domain/slug";
import { mediaUrl } from "@/lib/media-url";
import { safely } from "@/lib/safely";
import { createPublicClient } from "@/lib/supabase/public";

// Pages are built on first visit, cached, and rebuilt when the post is edited or every 5 minutes.
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

const load = cache(async (slug: string): Promise<PublicArticle | null> => {
  if (!SLUG_PATTERN.test(slug) || slug.length > 120) return null;
  return safely(
    "article",
    () => getPublicArticle(createPublicClient(), slug),
    null,
  );
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await load((await params).slug);
  if (!article) return { title: "Not found" };
  const { post, media } = article;
  const cover = post.cover_media_id ? media[post.cover_media_id] : undefined;
  return {
    title: post.title,
    description: post.deck || undefined,
    alternates: { canonical: `/posts/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.deck || undefined,
      publishedTime: post.published_at ?? undefined,
      images: cover
        ? [{ url: mediaUrl(cover.storage_path), alt: cover.alt }]
        : undefined,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const article = await load((await params).slug);
  if (!article) notFound();
  return <ArticleView article={article} />;
}
