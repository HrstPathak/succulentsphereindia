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
const BASE_PATH = "/collections/cactus";
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
      { "@type": "ListItem", position: 2, name: "Cacti Collection", item: "https://succulentsphere.com/collections/cactus" },
      { "@type": "ListItem", position: 3, name: "All Cacti", item: "https://succulentsphere.com/collections/cactus" },
    ],
  };
}

function buildCollectionJson(products: any[], page: number, offset: number) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Cacti Collection${page > 1 ? ` - Page ${page}` : ""}`,
    description: "Unique desert cacti with stunning shapes and colors.",
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
    scopedCollection: "cactus",
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
  const title = page > 1 ? `Cacti Collection - Page ${page} | Succulent Sphere` : "Cacti Collection | Succulent Sphere";
  const description =
    page > 1
      ? `Browse cacti collection page ${page}. Unique desert cacti with stunning shapes and colors.`
      : "Unique desert cacti with stunning shapes and colors.";

  return {
    title,
    description,
    alternates: {
      canonical: page > 1 ? `${BASE_PATH}?page=${page}` : BASE_PATH,
    },
  };
}

export default async function CactusPage({
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

      <section className="bg-[var(--color-bg)] pb-12" style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 20px)" }}>
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-serif text-center mb-2">Cacti Collection</h1>
          <p className="text-center max-w-2xl mx-auto mb-6 text-sm">Unique desert cacti with stunning shapes and colors.</p>

          <nav className="text-xs" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-[var(--color-text)]">
              <li><Link href="/">Home</Link></li>
              <li>&rsaquo;</li>
              <li><Link href="/collections/cactus" aria-current="page" className="font-medium">Cacti Collection</Link></li>
              <li>&rsaquo;</li>
              <li>All Cacti</li>
            </ol>
          </nav>

          <div className="mt-6">
            <CollectionGridClient products={products} collectionHandle="cactus" page={page} totalPages={totalPages} pageSize={PAGE_SIZE} />
          </div>

          <CategoryGrid className="mt-10" excludeHrefs={["/collections/cactus"]} />

          <TrustBar />
          <RecentlyViewedProducts className="mt-6" />
        </div>
      </section>
    </>
  );
}
