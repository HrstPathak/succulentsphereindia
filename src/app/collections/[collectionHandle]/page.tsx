import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
const NOINDEX_COLLECTIONS = new Set(["pots", "gift-collection", "air-purifier"]);
type ListingSearchParams = Record<string, string | string[] | undefined>;

const COLLECTION_METADATA: Record<string, { name: string; description: string }> = {
  succulents: {
    name: "Succulent Plants",
    description: "Handpicked premium succulents to enrich your home and workspace.",
  },
  "air-plants": {
    name: "Air Plants",
    description: "Low-maintenance air plants that purify your environment.",
  },
  "air-purifier": {
    name: "Air Purifier",
    description: "Air-purifying plants curated for healthier interiors.",
  },
  cacti: {
    name: "Cacti Collection",
    description: "Unique desert cacti with stunning shapes and colors.",
  },
  pots: {
    name: "Pots Collection",
    description: "Elegant pots for premium plant styling.",
  },
  "gift-collection": {
    name: "Gift Collection",
    description: "Ready-to-gift plant combos and curated green hampers.",
  },
  "rare-plants": {
    name: "Rare & Exotic",
    description: "Exclusive rare plants for collectors and enthusiasts.",
  },
};

function buildCollectionPageUrl(collectionHandle: string, page: number) {
  return page > 1
    ? `https://succulentsphere.com/collections/${collectionHandle}?page=${page}`
    : `https://succulentsphere.com/collections/${collectionHandle}`;
}

function buildBreadcrumbJson(collectionName: string, collectionHandle: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://succulentsphere.com" },
      { "@type": "ListItem", position: 2, name: "Collections", item: "https://succulentsphere.com/collections" },
      { "@type": "ListItem", position: 3, name: collectionName, item: `https://succulentsphere.com/collections/${collectionHandle}` },
    ],
  };
}

function buildCollectionJson(collectionName: string, collectionHandle: string, products: any[], page: number, offset: number) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${collectionName}${page > 1 ? ` - Page ${page}` : ""}`,
    description: COLLECTION_METADATA[collectionHandle]?.description || collectionName,
    url: buildCollectionPageUrl(collectionHandle, page),
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

async function fetchPaginatedProducts(page: number, collectionHandle: string, searchParamState: ListingSearchParams = {}) {
  const baseUrl = await getRequestOrigin();
  const queryState = parseCatalogQueryState(searchParamState, { defaultPage: page });
  const apiParams = buildCatalogApiSearchParams({
    sort: queryState.sort,
    filters: queryState.filters,
    page,
    pageSize: PAGE_SIZE,
    scopedCollection: collectionHandle,
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
  params,
  searchParams,
}: {
  params: Promise<{ collectionHandle?: string }> | { collectionHandle?: string };
  searchParams?: Promise<ListingSearchParams> | ListingSearchParams;
}): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const collectionHandle = resolvedParams?.collectionHandle || "";
  const metadata = COLLECTION_METADATA[collectionHandle];
  if (!metadata) return {};

  const resolvedSearch = await Promise.resolve(searchParams || {});
  const page = parseCatalogQueryState(resolvedSearch, { defaultPage: 1 }).page;
  const title = page > 1 ? `${metadata.name} - Page ${page} | Succulent Sphere` : `${metadata.name} | Succulent Sphere`;
  const description =
    page > 1
      ? `${metadata.description} Browse page ${page}.`
      : metadata.description;

  return {
    title,
    description,
    alternates: {
      canonical: page > 1 ? `/collections/${collectionHandle}?page=${page}` : `/collections/${collectionHandle}`,
    },
    robots: NOINDEX_COLLECTIONS.has(collectionHandle)
      ? {
          index: false,
          follow: true,
        }
      : undefined,
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ collectionHandle?: string }> | { collectionHandle?: string };
  searchParams?: Promise<ListingSearchParams> | ListingSearchParams;
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearch = await Promise.resolve(searchParams || {});
  const collectionHandle = resolvedParams?.collectionHandle ?? "";
  const page = parseCatalogQueryState(resolvedSearch, { defaultPage: 1 }).page;
  const offset = (page - 1) * PAGE_SIZE;

  const collectionMetadata = COLLECTION_METADATA[collectionHandle];
  if (!collectionMetadata) notFound();

  const { results: products, totalPages } = await fetchPaginatedProducts(page, collectionHandle, resolvedSearch);

  const breadcrumbJson = buildBreadcrumbJson(collectionMetadata.name, collectionHandle);
  const collectionJson = buildCollectionJson(collectionMetadata.name, collectionHandle, products, page, offset);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJson) }} />

      <section className="bg-[var(--color-bg)] py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-serif text-center mb-2 mt-5">{collectionMetadata.name}</h1>
          <p className="text-center max-w-2xl mx-auto mb-6 text-sm">{collectionMetadata.description}</p>

          <nav className="text-xs" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-[var(--color-text)]">
              <li><Link href="/">Home</Link></li>
              <li>&rsaquo;</li>
              <li><Link href="/collections">Collections</Link></li>
              <li>&rsaquo;</li>
              <li><Link href={`/collections/${collectionHandle}`} aria-current="page" className="font-medium">{collectionMetadata.name}</Link></li>
            </ol>
          </nav>

          <div className="mt-6">
            <CollectionGridClient products={products} collectionHandle={collectionHandle} page={page} totalPages={totalPages} pageSize={PAGE_SIZE} />
          </div>

          <CategoryGrid className="mt-10" excludeHrefs={[`/collections/${collectionHandle}`]} />

          <TrustBar />
          <RecentlyViewedProducts className="mt-6" />
        </div>
      </section>
    </>
  );
}
