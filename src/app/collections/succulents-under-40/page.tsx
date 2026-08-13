import type { Metadata } from "next";
import Link from "next/link";
import TrustBar from "../../../components/TrustBar";
import CollectionGridClient from "../../../components/shop/CollectionGridClient";
import RecentlyViewedProducts from "../../../components/shop/RecentlyViewedProducts";
import { getRequestOrigin } from "@/lib/request-origin";
import { buildCatalogApiSearchParams, parseCatalogQueryState } from "@/lib/catalogQueryParams";

export const revalidate = 60;

const PAGE_SIZE = 20;
const BASE_PATH = "/collections/succulents-under-40";
const MAX_PRICE = 39;
const DEFAULT_SORT = "low-to-high" as const;
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
      { "@type": "ListItem", position: 3, name: "Succulents at ₹39", item: "https://succulentsphere.com/collections/succulents-under-40" },
    ],
  };
}

function buildCollectionJson(products: any[], page: number, offset: number) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Succulents at ₹39${page > 1 ? ` - Page ${page}` : ""}`,
    description: "Budget-friendly succulent plants priced under ₹40, curated for easy and affordable gifting, desks, and first plant buys.",
    url: buildPageUrl(page),
    hasPart: products.map((p, i) => ({
      "@type": "Product",
      position: offset + i + 1,
      name: p.title,
      image: p.image,
      description: p.title,
      brand: { "@type": "Brand", name: "Succulent Sphere" },
      offers: {
        "@type": "Offer",
        priceCurrency: p.currency || "INR",
        price: p.price,
        availability: p.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: `https://succulentsphere.com/products/${p.handle}`,
      },
    })),
  };
}

async function fetchPaginatedProducts(page: number, searchParamState: ListingSearchParams = {}) {
  const baseUrl = await getRequestOrigin();
  const queryState = parseCatalogQueryState(searchParamState, {
    defaultPage: page,
    defaultSort: DEFAULT_SORT,
    defaultPriceRange: { min: 0, max: MAX_PRICE },
  });
  const apiParams = buildCatalogApiSearchParams({
    sort: queryState.sort,
    filters: queryState.filters,
    page,
    pageSize: PAGE_SIZE,
    scopedCollection: "succulents",
    enforcedPriceRange: { min: 0, max: MAX_PRICE },
  });
  const url = `${baseUrl}/api/products?${apiParams.toString()}`;

  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return { results: [], totalPages: 1 };

  const json = await res.json();
  const results = Array.isArray(json?.results)
    ? json.results.filter((product: any) => Number(product?.price ?? 0) <= MAX_PRICE)
    : [];

  return {
    results,
    totalPages: results.length > 0 ? Math.max(1, Number(json?.pagination?.totalPages) || 1) : 1,
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<ListingSearchParams> | ListingSearchParams;
}): Promise<Metadata> {
  const resolved = await Promise.resolve(searchParams || {});
  const page = parseCatalogQueryState(resolved, { defaultPage: 1 }).page;
  const title = page > 1 ? `Succulents at ₹39 - Page ${page} | Succulent Sphere` : "Succulents at ₹39 | Succulent Sphere";
  const description =
    page > 1
      ? `Browse affordable succulent plants under ₹40 on page ${page}.`
      : "Shop affordable succulent plants under ₹40, curated for budget-friendly gifting and first-time plant parents.";

  return {
    title,
    description,
    alternates: {
      canonical: page > 1 ? `${BASE_PATH}?page=${page}` : BASE_PATH,
    },
  };
}

export default async function SucculentsUnderFortyPage({
  searchParams,
}: {
  searchParams?: Promise<ListingSearchParams> | ListingSearchParams;
}) {
  const resolved = await Promise.resolve(searchParams || {});
  const page = parseCatalogQueryState(resolved, {
    defaultPage: 1,
    defaultSort: DEFAULT_SORT,
    defaultPriceRange: { min: 0, max: MAX_PRICE },
  }).page;
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
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[var(--color-brand)]">
              Affordable picks
            </p>
            <h1 className="mt-4 text-4xl font-serif text-[var(--color-text)] md:text-5xl">Succulents at ₹39</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text)]/80 md:text-base">
              Discover budget-friendly succulent plants priced below ₹40, chosen for easy styling, gifting, and first plant purchases.
            </p>
          </div>

          <nav className="mt-6 text-xs" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-[var(--color-text)]">
              <li><Link href="/">Home</Link></li>
              <li>&rsaquo;</li>
              <li><Link href="/collections">Collections</Link></li>
              <li>&rsaquo;</li>
              <li><Link href="/collections/succulents-under-40" aria-current="page" className="font-medium">Succulents at ₹39</Link></li>
            </ol>
          </nav>

          <div className="mt-6">
            <CollectionGridClient
              products={products}
              collectionHandle="succulents"
              enforcedPriceRange={{ min: 0, max: MAX_PRICE }}
              resetFiltersOnMount
              page={page}
              totalPages={totalPages}
              pageSize={PAGE_SIZE}
              defaultSort={DEFAULT_SORT}
            />
          </div>

          <TrustBar />
          <RecentlyViewedProducts className="mt-6" />
        </div>
      </section>
    </>
  );
}
