import type { Metadata } from "next";
import dynamic from "next/dynamic";
import HeroSection from "../components/home/HeroSection";
import CategoryGrid from "../components/home/CategoryGrid";
import BestSellerGrid from "../components/home/BestSellerGrid";
import ComboTeaserBanner from "../components/home/ComboTeaserBanner";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";
import { fetchAllProductsList } from "@/lib/commerce";
import { resolveProductImageAlt } from "@/lib/imageAlt";
import { buildPageMetadata } from "@/lib/page-metadata";
import { toJsonLd } from "@/lib/structured-data";
import { mockProducts, type Product } from "@/data/mockProducts";
import {
  LazyOnTheFeedSection,
  LazyRecentlyViewedSection,
} from "../components/home/LazySections";

const BrandStory = dynamic(() => import("../components/home/BrandStory"), {
  loading: () => <div className="h-[320px] w-full animate-pulse rounded-3xl bg-gradient-to-r from-gray-100 via-white to-gray-100 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800" />,
});

const InstagramFeed = dynamic(() => import("../components/home/InstagramFeed"), {
  loading: () => <div className="h-[180px] w-full animate-pulse rounded-2xl bg-gradient-to-r from-gray-100 via-white to-gray-100 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800" />,
});

const Testimonials = dynamic(() => import("../components/home/Testimonials"), {
  loading: () => <div className="h-[260px] w-full animate-pulse rounded-3xl bg-gradient-to-r from-gray-100 via-white to-gray-100 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800" />,
});

export const revalidate = 3600;
export const metadata: Metadata = buildPageMetadata({
  pageKey: "home",
  pathname: "/",
});

function buildWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/shop")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}

function hasTag(tags: string[] | undefined, wantedTag: string): boolean {
  if (!Array.isArray(tags) || tags.length === 0) return false;
  const target = normalizeTag(wantedTag);
  return tags.some((tag) => normalizeTag(String(tag)) === target);
}

function shuffleBestSellers<T>(items: T[], desiredCount = 20): T[] {
  if (!items.length) return [];
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor((Date.now() / 1000 + i) % (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(desiredCount, pool.length));
}

type HomeBestSellerCandidate = Product & {
  id: string;
  title: string;
  handle: string;
  image: string;
  imageAlt?: string;
  price: string;
  compareAtPrice?: string | null;
  currency?: string;
  tags: string[];
};

function mapBestSellerProduct(product: HomeBestSellerCandidate) {
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    image: product.image,
    imageAlt: resolveProductImageAlt(product.imageAlt || product.title || "Best seller product"),
    price: String(product.price ?? "0.00"),
    compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : null,
    currency: String(product.currency ?? "INR"),
    badge: "Best Seller",
    rating: Number(product.rating || 5),
  };
}

function buildBestSellerPool(primary: HomeBestSellerCandidate[], desiredCount = 20) {
  const seen = new Set<string>();
  const curated: HomeBestSellerCandidate[] = [];
  const fallback = mockProducts.filter((product) => hasTag(product.tags, "best seller")) as HomeBestSellerCandidate[];

  for (const product of [...primary, ...fallback]) {
    const key = String(product.handle || product.id || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    curated.push(product);
  }

  return shuffleBestSellers(curated, desiredCount).map(mapBestSellerProduct);
}

async function getHomeBestSellerProducts() {
  try {
    const products = await fetchAllProductsList({
      sortKey: "CREATED_AT",
      reverse: true,
    });

    const normalized = products.map((product) => ({
      ...product,
      tags: Array.isArray(product.tags) ? product.tags.map((tag: unknown) => String(tag).trim()) : [],
    }));

    const bestSelling = normalized.filter(
      (product) =>
        product.handle &&
        (hasTag(product.tags, "best seller") || hasTag(product.tags, "best selling") || hasTag(product.tags, "best-selling")),
    );

    const fallbackPool = normalized.filter((product) => product.handle && !bestSelling.some((item) => item.id === product.id));
    const curatedPool = [
      [...bestSelling, ...fallbackPool].slice(0, 24),
    ].flat() as HomeBestSellerCandidate[];

    return buildBestSellerPool(curatedPool);
  } catch {
    return buildBestSellerPool([]);
  }
}

export default async function Home() {
  const websiteJsonLd = buildWebsiteJsonLd();
  const bestSellerProducts = await getHomeBestSellerProducts();
  const sectionSpacingClass = "py-10 md:py-14 lg:py-16";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(websiteJsonLd) }} />
      <header />
      <HeroSection />
      
      <section className={`${sectionSpacingClass} bg-gradient-to-b from-transparent via-[var(--color-bg)] to-transparent`}>
        <div className="container mx-auto px-4">
          <CategoryGrid />
        </div>
      </section>

      <section className="pt-2 pb-6 md:pt-3 md:pb-8">
        <div className="container mx-auto px-4">
          <ComboTeaserBanner />
        </div>
      </section>

      <section className="pb-2 md:pb-4">
        <div className="container mx-auto px-4">
          <div className="rounded-2xl border border-[var(--auth-border)] bg-white/80 px-5 py-6 text-center shadow-[0_10px_30px_rgba(13,27,21,0.08)]">
            <h2 className="text-2xl font-serif text-[var(--color-text)] md:text-3xl">
              India&apos;s Finest Succulents, Delivered to Your Door
            </h2>
            <p className="mt-2 text-sm text-[var(--auth-muted)] md:text-base">
              Handpicked premium succulents - grown with care, shipped fresh across India.
            </p>
          </div>
        </div>
      </section>

      <section className="pt-2 pb-2 md:pt-3 md:pb-4">
        <div className="container mx-auto px-4">
          <LazyRecentlyViewedSection />
        </div>
      </section>

      <section className={sectionSpacingClass}>
        <div className="container mx-auto px-4">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-serif text-center text-[var(--color-text)]">Best Selling Succulent Plants</h2>
            <p className="text-center text-gray-600 dark:text-gray-400 mt-2">Top-rated succulent plant picks loved by our customers</p>
          </div>
          <BestSellerGrid products={bestSellerProducts} />
        </div>
      </section>

      <section className={`${sectionSpacingClass} bg-gradient-to-r from-[var(--color-bg)] to-transparent`}>
        <div className="container mx-auto px-4">
          <BrandStory />
        </div>
      </section>

      <section className={sectionSpacingClass}>
        <div className="container mx-auto px-4">
          <InstagramFeed />
        </div>
      </section>

      <section className={sectionSpacingClass}>
        <LazyOnTheFeedSection />
      </section>

      <section className={`${sectionSpacingClass} bg-gradient-to-b from-transparent to-[var(--color-bg)]`}>
        <div className="container mx-auto px-4">
          <Testimonials />
        </div>
      </section>

      <section className={`${sectionSpacingClass} pt-0`}>
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-serif text-[var(--color-text)] text-center mb-4">
            Shop Healthy Succulent Plant Varieties for Every Space
          </h2>
          <p className="text-center text-gray-700 dark:text-gray-300 leading-relaxed">
            Looking for a low-maintenance succulent plant for your home, desk, or gift set? Succulent Sphere offers
            handpicked succulent plants with secure packaging, care-friendly selections, and curated collections for
            beginners and collectors.
          </p>
        </div>
      </section>
    </>
  );
}
