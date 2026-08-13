import type { Metadata } from "next";
import HeroSection from "../components/home/HeroSection";
import CategoryGrid from "../components/home/CategoryGrid";
import BestSellerGrid from "../components/home/BestSellerGrid";
import BrandStory from "../components/home/BrandStory";
import InstagramFeed from "../components/home/InstagramFeed";
import ComboTeaserBanner from "../components/home/ComboTeaserBanner";
import Testimonials from "../components/home/Testimonials";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";
import { fetchProductsByQuery } from "@/lib/commerce";
import { resolveProductImageAlt } from "@/lib/imageAlt";
import { buildPageMetadata } from "@/lib/page-metadata";
import { toJsonLd } from "@/lib/structured-data";
import {
  LazyOnTheFeedSection,
  LazyRecentlyViewedSection,
} from "../components/home/LazySections";

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

function productCardImage(url: string) {
  return url;
}


type HomeBestSellerCandidate = {
  id: string;
  title: string;
  handle: string;
  image: string;
  imageAlt: string;
  price: string;
  compareAtPrice?: string | null;
  currency?: string;
  tags: string[];
};

async function getHomeBestSellerProducts() {
  try {
    const res = await fetchProductsByQuery(`tag:"Best Selling"`, {
      first: 60,
      sortKey: "BEST_SELLING",
      reverse: false,
      cache: "force-cache",
      next: { revalidate: 3600, tags: ["home-best-sellers"] },
    });
    const mapped: HomeBestSellerCandidate[] = (res.edges || []).map((edge: any, idx: number) => {
      const node = edge?.node || {};
      const image = node?.images?.edges?.[0]?.node?.url || "/assets/product-1.jpg";
      const imageAlt = resolveProductImageAlt(node?.images?.edges?.[0]?.node?.altText);
      const variant = node?.variants?.edges?.[0]?.node;
      return {
        id: String(node.id || `catalog-best-seller-${idx}`),
        title: String(node.title || "Untitled"),
        handle: String(node.handle || ""),
        image: productCardImage(String(image)),
        imageAlt,
        price: String(variant?.price?.amount ?? variant?.priceV2?.amount ?? "0.00"),
        compareAtPrice: variant?.compareAtPrice?.amount ? String(variant.compareAtPrice.amount) : null,
        currency: String(variant?.price?.currencyCode ?? variant?.priceV2?.currencyCode ?? "INR"),
        tags: Array.isArray(node.tags) ? node.tags.map((tag: unknown) => String(tag)) : [],
      };
    });
    const tagged = mapped.filter((product) => product.handle && hasTag(product.tags, "Best Selling"));

    const ordered = tagged.slice().sort((a, b) => a.title.localeCompare(b.title));
    return ordered.slice(0, 4).map((product) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      image: product.image,
      imageAlt: product.imageAlt,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? null,
      currency: product.currency ?? "INR",
      badge: "Best Seller",
      rating: 5,
    }));
  } catch {
    return [];
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
