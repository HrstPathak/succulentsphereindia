import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { fetchPlantCareArticles } from "@/lib/commerce";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Plant Care Journal — Succulent care guides for Indian homes | Succulent Sphere",
  description:
    "Succulent plant care guides for Indian homes — climate-aware watering schedules, monsoon tips, soil mixes and practical routines from Succulent Sphere.",
  alternates: {
    canonical: "/plant-care",
  },
  keywords: [
    "succulent care",
    "plant care India",
    "succulent watering",
    "succulent soil mix",
    "monsoon plant care",
  ],
  robots: {
    index: true,
    follow: true,
  },
  twitter: {
    card: "summary_large_image",
    title: "Plant Care Journal — Succulent Sphere",
    description:
      "Practical succulent and cactus care for Indian homes: watering, potting and seasonal tips from Succulent Sphere.",
  },
  openGraph: {
    title: "Plant Care Journal — Succulent Sphere",
    description:
      "Succulent plant care guides for Indian homes — watering schedules, monsoon tips, soil mixes, and beginner advice by Succulent Sphere.",
    url: "/plant-care",
    type: "website",
  },
};

function formatDate(value: string): string {
  if (!value) return "Recently published";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently published";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PlantCarePage() {
  let articles = [];
  try {
    articles = await fetchPlantCareArticles(24);
  } catch (error) {
    console.error("Failed to fetch plant care blogs:", error);
  }
  const blogSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Plant Care Journal | Succulent Sphere",
    description:
      "Succulent plant care guides for Indian homes — watering schedules, monsoon tips, soil mixes, and beginner advice by Succulent Sphere.",
    url: `${SITE_URL}/plant-care`,
    publisher: {
      "@type": "Organization",
      name: "Succulent Sphere",
      url: SITE_URL,
    },
    blogPost: articles.map((article: any) => ({
      "@type": "BlogPosting",
      headline: article.title,
      url: `${SITE_URL}/plant-care/${article.handle}`,
      datePublished: article.publishedAt,
      author: {
        "@type": "Person",
        name: article.authorName || "Succulent Sphere Editorial Team",
      },
      description: article.seoDescription || article.excerpt,
      image: article.image?.url || undefined,
    })),
  };

  return (
    <section
      className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]"
      style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }} />
      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6 md:pb-24">
        <header className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--color-secondary)]">Succulent Sphere Journal</p>
          <h1 className="font-serif text-4xl leading-tight text-[var(--color-brand)] md:text-6xl">Plant Care</h1>
          <details className="mx-auto mt-5 max-w-2xl text-left">
            <summary className="cursor-pointer list-none">
              <span
                className="block text-sm leading-7 text-[rgb(var(--ss-text-rgb)/0.8)] md:text-base"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                Thoughtfully written succulent and cactus care guides for Indian homes, rooted in real climate conditions, practical routines, and long-term plant health.
              </span>
              <span className="mt-2 inline-block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-brand)]">
                Read full intro
              </span>
            </summary>
            <div className="mt-3 space-y-4 text-sm leading-7 text-[rgb(var(--ss-text-rgb)/0.9)] md:text-base">
              <p>
                Succulent and cactus care guides written specifically for Indian homes — not generic advice copied from foreign gardening blogs.
              </p>
              <p>
                India's climate is unlike anywhere else succulents are grown. Mumbai's monsoon humidity, Delhi's dry winters, Chennai's year-round heat, Bangalore's mild but unpredictable rain — each city creates different challenges for the same plant. Every guide in this journal is written with that in mind: real advice, tested in Indian conditions, covering watering schedules, seasonal care, soil mixes, pest fixes, and common mistakes Indian plant owners actually make.
              </p>
              <p>
                Whether you just received your first succulent or you're troubleshooting a plant that's been struggling for weeks — start here.
              </p>
            </div>
          </details>
        </header>
        <p className="mb-6 text-center text-sm text-[rgb(var(--ss-text-rgb)/0.75)] md:text-base">
          {articles.length} {articles.length === 1 ? "curated guide" : "curated guides"}
        </p>

        {articles.length === 0 ? (
          <div className="mx-auto max-w-3xl rounded-2xl border border-[rgb(var(--ss-secondary-rgb)/0.3)] bg-white/70 p-10 text-center shadow-[0_12px_40px_rgba(52,78,65,0.08)]">
            <h2 className="font-serif text-3xl text-[var(--color-brand)]">No articles yet</h2>
            <p className="mt-3 text-sm text-[rgb(var(--ss-text-rgb)/0.8)] md:text-base">
              We are preparing fresh plant care stories. Please check back shortly.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {articles.map((article) => (
                <article
                  key={article.id}
                  className="group overflow-hidden rounded-2xl border border-[rgb(var(--ss-secondary-rgb)/0.3)] bg-white shadow-[0_14px_36px_rgba(52,78,65,0.08)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_18px_44px_rgba(52,78,65,0.15)]"
                >
                  <Link href={`/plant-care/${article.handle}`} className="block">
                    <div className="relative aspect-[4/3] overflow-hidden">
                      {article.image?.url ? (
                        <Image
                          src={article.image.url}
                          alt={article.image.altText || article.title}
                          fill
                          loading={article.pinned ? "eager" : "lazy"}
                          priority={Boolean(article.pinned)}
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[rgb(var(--ss-secondary-rgb)/0.25)] text-sm text-[rgb(var(--ss-brand-rgb)/0.8)]">
                          Plant care article
                        </div>
                      )}
                      {article.pinned ? (
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand)] shadow-sm backdrop-blur-sm">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-45"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                          Pinned
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-4 p-6">
                      <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-secondary)]">{formatDate(article.publishedAt)}</p>
                      <h2 className="font-serif text-2xl leading-tight text-[var(--color-brand)]">{article.title}</h2>
                      <p className="line-clamp-3 text-sm leading-7 text-[rgb(var(--ss-text-rgb)/0.85)]">{article.excerpt}</p>
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-300 group-hover:bg-[var(--color-brand)]">
                          Read More
                        </span>
                        <span className="text-[11px] tracking-[0.08em] uppercase text-[rgb(var(--ss-brand-rgb)/0.75)]">
                          by {article.authorName || "Succulent Sphere Editorial Team"}
                        </span>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
