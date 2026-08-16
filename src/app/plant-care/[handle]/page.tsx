import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPlantCareArticleByHandle, fetchPlantCareArticles } from "@/lib/commerce";

// Client-side language experience for article translations
import ArticleLanguageExperience from "@/components/plant-care/ArticleLanguageExperience";
import YourSucculentsArticle from "@/components/plant-care/YourSucculentsArticle";
import ArticleBilingual from "@/components/plant-care/ArticleBilingual";

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

function buildArticleSchema(article: { title: string; seoDescription: string; publishedAt: string; handle: string; image?: { url: string } | null }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.seoDescription || "Succulent care guide — unboxing, potting, watering, and climate-aware tips for Indian homes.",
    author: { "@type": "Organization", name: "Succulent Sphere" },
    datePublished: article.publishedAt || new Date().toISOString(),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://www.succulentsphere.in/plant-care/${article.handle}`,
    },
    image: article.image?.url ? [article.image.url] : undefined,
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

  const seoTitle = `${article.title} | Plant Care | Succulent Sphere`;
  const seoDescription = article.seoDescription || article.excerpt || "Succulent care guides for Indian homes — unboxing, potting, watering, and climate-aware tips from Succulent Sphere.";
  const canonical = `/plant-care/${article.handle}`;

  return {
    title: seoTitle,
    description: seoDescription,
    alternates: {
      canonical,
    },
    keywords: [
      "succulent care",
      "succulent care India",
      "succulent care tips India",
      "succulent watering tips",
      "how to pot succulents",
      "succulent unboxing guide",
      "bare-root succulents delivery",
      "monsoon succulent care",
      "succulent potting mix India",
      "succulent care hindi",
      "सक्सुलेन्ट केयर",
      "succulent watering India",
      "plant care guide India",
      "succulent recovery after shipping",
      "succulent soil and drainage",
      "succulent acclimation India",
      "Succulent Sphere",
    ],
    robots: {
      index: true,
      follow: true,
    },
    twitter: {
      card: "summary_large_image",
      title: seoTitle,
      description: seoDescription,
      images: article.image?.url ? [article.image.url] : undefined,
    },
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      url: canonical,
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

  const articleSchema = buildArticleSchema({
    title: article.title,
    seoDescription: article.seoDescription || article.excerpt,
    publishedAt: article.publishedAt,
    handle: article.handle,
    image: article.image ?? null,
  });

  return (
    <section
      className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]"
      style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <div className="mx-auto max-w-5xl px-4 pb-16 md:px-6 md:pb-24">
      {article.handle === 'your-succulents-just-arrived' ? (
          <ArticleBilingual />
        ) : (
          <ArticleLanguageExperience article={article} contentHtml={contentHtml} />
        )}
      </div>
    </section>
  );
}
