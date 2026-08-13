import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPlantCareArticleByHandle, fetchPlantCareArticles } from "@/lib/commerce";

export const revalidate = 3600;

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

function sanitizeHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function buildFaqSchema(article: { title: string; excerpt: string; handle: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What is this article about: ${article.title}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: article.excerpt || "This guide shares practical plant care tips and best practices.",
        },
      },
      {
        "@type": "Question",
        name: "Where can I find more plant care guides?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You can explore more guides in the Succulent Sphere Plant Care journal at /plant-care.",
        },
      },
    ],
  };
}

export async function generateStaticParams() {
  try {
    const articles = await fetchPlantCareArticles(24);
    return articles.map((article) => ({ handle: article.handle }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const article = await fetchPlantCareArticleByHandle(handle);

  if (!article) {
    return {
      title: "Plant Care Article | Succulent Sphere",
      description: "Plant care insights from Succulent Sphere.",
    };
  }

  return {
    title: `${article.title} | Plant Care | Succulent Sphere`,
    description: article.seoDescription || article.excerpt,
    alternates: {
      canonical: `/plant-care/${article.handle}`,
    },
    openGraph: {
      title: `${article.title} | Plant Care | Succulent Sphere`,
      description: article.seoDescription || article.excerpt,
      url: `/plant-care/${article.handle}`,
      type: "article",
      publishedTime: article.publishedAt,
      images: article.image?.url ? [{ url: article.image.url, alt: article.image.altText || article.title }] : undefined,
    },
  };
}

export default async function PlantCareArticlePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  let article = null;

  try {
    article = await fetchPlantCareArticleByHandle(handle);
  } catch (error) {
    console.error("Failed to fetch plant care article:", error);
  }

  if (!article) {
    notFound();
  }

  const contentHtml = sanitizeHtml(article.contentHtml || "<p>Content unavailable.</p>");
  const faqSchema = buildFaqSchema({
    title: article.title,
    excerpt: article.seoDescription || article.excerpt,
    handle: article.handle,
  });

  return (
    <section
      className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]"
      style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <div className="mx-auto max-w-5xl px-4 pb-16 md:px-6 md:pb-24">
        <nav className="mb-6 text-sm text-[var(--color-text)]/75">
          <Link href="/plant-care" className="transition-colors hover:text-[var(--color-brand)]">
            Plant Care
          </Link>
          <span className="mx-2 text-[var(--color-secondary)]">/</span>
          <span className="text-[var(--color-brand)]">{article.title}</span>
        </nav>

        <header className="mb-8 md:mb-10">
          <p className="mb-3 text-xs uppercase tracking-[0.15em] text-[var(--color-secondary)]">{formatDate(article.publishedAt)}</p>
          <h1 className="font-serif text-4xl leading-tight text-[var(--color-brand)] md:text-6xl">{article.title}</h1>
        </header>

        <div className="overflow-hidden rounded-2xl border border-[var(--color-secondary)]/30 bg-white shadow-[0_18px_50px_rgba(52,78,65,0.12)]">
          <div className="relative aspect-[16/9] w-full">
            {article.image?.url ? (
              <Image
                src={article.image.url}
                alt={article.image.altText || article.title}
                fill
                priority
                className="object-cover"
                sizes="100vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--color-secondary)]/20 text-[var(--color-brand)]/70">
                Plant care article
              </div>
            )}
          </div>

          <article className="px-5 py-8 md:px-10 md:py-12">
            <div
              className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:text-[var(--color-brand)] prose-p:text-[var(--color-text)] prose-p:leading-8 prose-a:text-[var(--color-accent)] prose-strong:text-[var(--color-brand)]"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
            <p className="mt-8 rounded-xl border border-[var(--color-secondary)]/35 bg-[var(--color-secondary)]/8 px-4 py-3 text-sm text-[var(--color-text)]">
              <span className="font-semibold text-[var(--color-brand)]">Author Name:</span> {article.authorName}
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
