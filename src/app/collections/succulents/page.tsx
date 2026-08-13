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
const BASE_PATH = "/collections/succulents";
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
      { "@type": "ListItem", position: 2, name: "Succulent Plants", item: "https://succulentsphere.com/collections/succulents" },
      { "@type": "ListItem", position: 3, name: "All Succulents", item: "https://succulentsphere.com/collections/succulents" },
    ],
  };
}

function buildCollectionJson(products: any[], page: number, offset: number) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Succulent Plants${page > 1 ? ` - Page ${page}` : ""}`,
    description: "Handpicked premium succulents to enrich your home and workspace.",
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

function toJsonLd(value: unknown) {
  // Prevent script tag breakouts and hydration mismatches caused by unescaped "<".
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

async function fetchPaginatedProducts(page: number, searchParamState: ListingSearchParams = {}) {
  const baseUrl = await getRequestOrigin();
  const queryState = parseCatalogQueryState(searchParamState, { defaultPage: page });
  const apiParams = buildCatalogApiSearchParams({
    sort: queryState.sort,
    filters: queryState.filters,
    page,
    pageSize: PAGE_SIZE,
    scopedCollection: "succulents",
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
  const title = page > 1 ? `Succulent Plants - Page ${page} | Succulent Sphere` : "Succulent Plants | Succulent Sphere";
  const description =
    page > 1
      ? `Browse succulent plants page ${page}. Handpicked premium succulents to enrich your home and workspace.`
      : "Handpicked premium succulents to enrich your home and workspace.";

  return {
    title,
    description,
    alternates: {
      canonical: page > 1 ? `${BASE_PATH}?page=${page}` : BASE_PATH,
    },
  };
}

export default async function SucculentsPage({
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(collectionJson) }} />

      <section className="bg-[var(--color-bg)] pb-12" style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 20px)" }}>
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-serif text-center mb-2">Succulent Plants</h1>
          <p className="text-center max-w-2xl mx-auto mb-6 text-sm">Handpicked premium succulents to enrich your home and workspace.</p>

          <nav className="text-xs" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-[var(--color-text)]">
              <li><Link href="/">Home</Link></li>
              <li>&rsaquo;</li>
              <li><Link href="/collections/succulents" aria-current="page" className="font-medium">Succulent Plants</Link></li>
              <li>&rsaquo;</li>
              <li>All Succulents</li>
            </ol>
          </nav>

          <div className="mt-6">
            <CollectionGridClient products={products} collectionHandle="succulents" page={page} totalPages={totalPages} pageSize={PAGE_SIZE} />
          </div>

          <CategoryGrid className="mt-10" excludeHrefs={["/collections/succulents"]} />

          <TrustBar />
          <RecentlyViewedProducts className="mt-6" />
        </div>
      </section>
    </>
  );
}
