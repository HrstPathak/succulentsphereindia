import type { Metadata } from "next";
import Link from "next/link";
import TrustBar from "../../../components/TrustBar";
import CollectionGridClient from "../../../components/shop/CollectionGridClient";
import RecentlyViewedProducts from "../../../components/shop/RecentlyViewedProducts";
import CategoryGrid from "../../../components/home/CategoryGrid";
import { getRequestOrigin } from "@/lib/request-origin";
import { buildListingOfferStructuredData } from "@/lib/structured-data";
import { buildCatalogApiSearchParams, parseCatalogQueryState } from "@/lib/catalogQueryParams";

export const revalidate = 60;

const PAGE_SIZE = 20;
const BASE_PATH = "/collections/pots";
type ListingSearchParams = Record<string, string | string[] | undefined>;

function buildPageUrl(page: number) {
  return page > 1
    ? `https://succulentsphere.com${BASE_PATH}?page=${page}`
    : `https://succulentsphere.com${BASE_PATH}`;
}

function buildBreadcrumbJson() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://succulentsphere.com" },
      { "@type": "ListItem", position: 2, name: "Collections", item: "https://succulentsphere.com/collections" },
      { "@type": "ListItem", position: 3, name: "Pots Collection", item: "https://succulentsphere.com/collections/pots" },
    ],
  };
}

function buildCollectionJson(products: any[], page: number, offset: number) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Pots Collection${page > 1 ? ` - Page ${page}` : ""}`,
    description: "Elegant pots for premium plant styling.",
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

async function fetchPaginatedProducts(page: number, searchParamState: ListingSearchParams = {}) {
  const baseUrl = await getRequestOrigin();
  const queryState = parseCatalogQueryState(searchParamState, { defaultPage: page });
  const apiParams = buildCatalogApiSearchParams({
    sort: queryState.sort,
    filters: queryState.filters,
    page,
    pageSize: PAGE_SIZE,
    scopedCollection: "pots",
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
  const title = page > 1 ? `Pots Collection - Page ${page} | Succulent Sphere` : "Pots Collection | Succulent Sphere";
  const description =
    page > 1
      ? `Browse pots collection page ${page}. Elegant pots for premium plant styling.`
      : "Elegant pots for premium plant styling.";

  return {
    title,
    description,
    alternates: {
      canonical: page > 1 ? `${BASE_PATH}?page=${page}` : BASE_PATH,
    },
  };
}

export default async function PotsPage({
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJson) }} />

      <section className="relative overflow-hidden bg-[var(--color-bg)] pb-12" style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(236,227,214,0.5),transparent_50%),radial-gradient(circle_at_80%_10%,rgba(163,177,138,0.25),transparent_45%)]" />
        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-900/70 dark:text-white/70">
              Premium planters
            </p>
            <h1 className="mt-4 text-4xl font-serif text-[var(--color-text)] md:text-6xl">
              Pots Collection
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text)]/80 md:text-base">
              Elegant pots for premium plant styling. Browse all designs below and add to cart instantly.
            </p>
          </div>

          <nav className="mt-6 text-xs" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-[var(--color-text)]">
              <li><Link href="/">Home</Link></li>
              <li>&rsaquo;</li>
              <li><Link href="/collections">Collections</Link></li>
              <li>&rsaquo;</li>
              <li><Link href="/collections/pots" aria-current="page" className="font-medium">Pots Collection</Link></li>
            </ol>
          </nav>

          <div id="pots-grid" className="mt-8 scroll-mt-28">
            <CollectionGridClient products={products} collectionHandle="pots" page={page} totalPages={totalPages} pageSize={PAGE_SIZE} />
          </div>

          <CategoryGrid className="mt-10" excludeHrefs={["/collections/pots"]} />

          <TrustBar />
          <RecentlyViewedProducts className="mt-6" />
        </div>
      </section>
    </>
  );
}

