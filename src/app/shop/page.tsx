import type { Metadata } from "next";
import Link from "next/link";
import TrustBar from "../../components/TrustBar";
import CollectionGridClient from "../../components/shop/CollectionGridClient";
import RecentlyViewedProducts from "../../components/shop/RecentlyViewedProducts";
import { getRequestOrigin } from "@/lib/request-origin";
import { SITE_URL } from "@/lib/seo";
import { buildListingOfferStructuredData } from "@/lib/structured-data";
import { buildCatalogApiSearchParams, parseCatalogQueryState } from "@/lib/catalogQueryParams";

export const revalidate = 60;

const PAGE_SIZE = 20;
const BASE_PATH = "/shop";
type ListingSearchParams = Record<string, string | string[] | undefined>;

function buildPageUrl(page: number) {
  if (page <= 1) return `${SITE_URL}${BASE_PATH}`;
  return `${SITE_URL}${BASE_PATH}?page=${page}`;
}

function buildBreadcrumbJson() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/shop` },
      { "@type": "ListItem", position: 3, name: "All Products", item: `${SITE_URL}/shop` },
    ],
  };
}

function buildCollectionJson(products: any[], page: number, offset: number) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Shop All Products${page > 1 ? ` - Page ${page}` : ""}`,
    description:
      "Shop premium succulent plants, cacti, and rare varieties online in India. Handpicked, safely packed, and delivered to your door. Starting from 39Rs.",
    url: buildPageUrl(page),
    hasPart: products.map((p, i) => ({
      "@type": "Product",
      position: offset + i + 1,
      name: p.title,
      image: p.image,
      description: p.title,
      brand: { "@type": "Brand", name: "Succulent Sphere" },
      offers: buildListingOfferStructuredData(p),
      ...(Number(p?.reviewCount || 0) > 0 && typeof p?.rating === "number" && Number.isFinite(p.rating)
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: p.rating,
              reviewCount: Number(p.reviewCount),
            },
          }
        : {}),
    })),
  };
}

function buildItemListJson(products: any[], page: number, offset: number) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Succulent Sphere Shop${page > 1 ? ` - Page ${page}` : ""}`,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      "@type": "ListItem",
      position: offset + i + 1,
      url: `${SITE_URL}/products/${p.handle}`,
      name: p.title,
    })),
  };
}

async function fetchPaginatedProducts(page: number, searchParamState: ListingSearchParams = {}) {
  const baseUrl = await getRequestOrigin();
  const queryState = parseCatalogQueryState(searchParamState, { defaultPage: page });
  const apiParams = buildCatalogApiSearchParams({
    sort: queryState.sort,
    filters: queryState.filters,
    page,
    pageSize: PAGE_SIZE,
  });
  const url = `${baseUrl}/api/products?${apiParams.toString()}`;

  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return { results: [], hasMore: false, totalPages: 1 };

  const json = await res.json();
  return {
    results: Array.isArray(json?.results) ? json.results : [],
    hasMore: Boolean(json?.pagination?.hasMore),
    totalPages: Math.max(1, Number(json?.pagination?.totalPages) || 1),
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<ListingSearchParams> | ListingSearchParams;
}): Promise<Metadata> {
  const resolved = await Promise.resolve(searchParams || {});
  const page = parseCatalogQueryState(resolved, { defaultPage: 1 }).page;
  const title = page > 1 ? `Shop All Products - Page ${page} | Succulent Sphere` : "Shop All Products | Succulent Sphere";
  const description =
    "Shop premium succulent plants, cacti, and rare varieties online in India. Handpicked, safely packed, and delivered to your door. Starting from 39Rs.";
  const canonical = page > 1 ? `${BASE_PATH}?page=${page}` : BASE_PATH;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
  };
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams?: Promise<ListingSearchParams> | ListingSearchParams;
}) {
  const resolved = await Promise.resolve(searchParams || {});
  const page = parseCatalogQueryState(resolved, { defaultPage: 1 }).page;
  const offset = (page - 1) * PAGE_SIZE;

  const { results: products, totalPages } = await fetchPaginatedProducts(page, resolved);

  const breadcrumbJson = buildBreadcrumbJson();
  const collectionJson = buildCollectionJson(products, page, offset);
  const itemListJson = buildItemListJson(products, page, offset);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJson) }} />

      <section className="bg-[var(--color-bg)] pb-12" style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 20px)" }}>
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-serif text-center mb-2">Shop All Products</h1>
          <p className="text-center max-w-2xl mx-auto mb-6 text-sm">Pots, succulents, combos, gifting sets, and more from Succulent Sphere.</p>

          <nav className="text-xs" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-[var(--color-text)]">
              <li><Link href="/">Home</Link></li>
              <li>&rsaquo;</li>
              <li><Link href="/shop" aria-current="page" className="font-medium">Shop</Link></li>
              <li>&rsaquo;</li>
              <li>All Products</li>
            </ol>
          </nav>

          <div className="mt-6">
            <CollectionGridClient products={products} productBasePath="products" page={page} totalPages={totalPages} pageSize={PAGE_SIZE} />
          </div>

          <TrustBar />
          <RecentlyViewedProducts className="mt-6" />

          <section className="mx-auto mt-8 max-w-5xl rounded-2xl border border-[var(--color-secondary)]/25 bg-white/70 px-6 py-7 shadow-[0_10px_30px_rgba(52,78,65,0.08)] md:px-8 md:py-9">
            <details>
              <summary className="cursor-pointer list-none">
                <span
                  className="block text-sm leading-7 text-[var(--color-text)]/90 md:text-base"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  Browse 50+ premium succulent plants, cacti, and rare varieties — handpicked for Indian homes and shipped safely across India. Finding healthy succulents online in India used to mean taking a gamble — plants arriving wilted, mislabelled, or packed in soil that guaranteed root rot within a week. Every plant at Succulent Sphere is individually selected for health, root strength, and shelf appeal before it is packed. Whether you are looking for a low-maintenance desk plant for your office in Bangalore, a statement cactus for a Mumbai balcony, or a rare Echeveria to add to your collection in Delhi — you will find it here. All plants ship with India-specific care instructions, and every order is backed by our secure packaging guarantee. Starting from just 39Rs.
                </span>
                <span className="mt-2 inline-block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-brand)]">
                  View full section
                </span>
              </summary>
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-7 text-[var(--color-text)]/90 md:text-base">
                  Browse 50+ premium succulent plants, cacti, and rare varieties — handpicked for Indian homes and shipped safely across India.
                </p>
                <p className="text-sm leading-7 text-[var(--color-text)]/90 md:text-base">
                  Finding healthy succulents online in India used to mean taking a gamble — plants arriving wilted, mislabelled, or packed in soil that guaranteed root rot within a week. Every plant at Succulent Sphere is individually selected for health, root strength, and shelf appeal before it is packed. Whether you are looking for a low-maintenance desk plant for your office in Bangalore, a statement cactus for a Mumbai balcony, or a rare Echeveria to add to your collection in Delhi — you will find it here.
                </p>
                <p className="text-sm leading-7 text-[var(--color-text)]/90 md:text-base">
                  All plants ship with India-specific care instructions, and every order is backed by our secure packaging guarantee. Starting from just 39Rs.
                </p>
              </div>
            </details>
          </section>
        </div>
      </section>
    </>
  );
}
