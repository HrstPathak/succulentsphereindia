import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import TrustBar from "../../../components/TrustBar";
import CollectionGridClient from "../../../components/shop/CollectionGridClient";
import RecentlyViewedProducts from "../../../components/shop/RecentlyViewedProducts";
import CategoryGrid from "../../../components/home/CategoryGrid";
import { getRequestOrigin } from "@/lib/request-origin";
import { buildListingOfferStructuredData } from "@/lib/structured-data";
import { buildCatalogApiSearchParams, parseCatalogQueryState } from "@/lib/catalogQueryParams";

export const revalidate = 60;

const PAGE_SIZE = 20;
const BASE_PATH = "/collections/beginner-friendly";
const REQUIRED_TAG = "Beginner";
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
      { "@type": "ListItem", position: 3, name: "Beginner Friendly Plant", item: "https://succulentsphere.com/collections/beginner-friendly" },
    ],
  };
}

function buildCollectionJson(products: any[], page: number, offset: number) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Beginner Friendly Plant${page > 1 ? ` - Page ${page}` : ""}`,
    description: "Easy-care succulent and cactus picks curated for first-time plant parents.",
    url: buildPageUrl(page),
    hasPart: products.map((p, i) => ({
      "@type": "Product",
      position: offset + i + 1,
      name: p.title,
      image: p.image,
      description: p.title,
      brand: { "@type": "Brand", name: "Succulent Sphere" },
      offers: buildListingOfferStructuredData(p),
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
    baseCollections: ["succulents", "cacti"],
    requiredTag: REQUIRED_TAG,
  });
  const url = `${baseUrl}/api/products?${apiParams.toString()}`;

  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return { results: [], totalPages: 1 };

  const json = await res.json();
  return {
    results: Array.isArray(json?.results) ? json.results : [],
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
  const title = page > 1 ? `Beginner Friendly Plant - Page ${page} | Succulent Sphere` : "Beginner Friendly Plant | Succulent Sphere";
  return {
    title,
    description: "Shop beginner-friendly plants including succulent and cactus varieties that are resilient, forgiving, and ideal for Indian indoor homes.",
    alternates: {
      canonical: page > 1 ? `${BASE_PATH}?page=${page}` : BASE_PATH,
    },
  };
}

export default async function BeginnerFriendlyPage({
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
          <h1 className="mb-2 text-center font-serif text-4xl text-[var(--color-text)]">Beginner Friendly Plant</h1>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-[var(--auth-muted)]">
            Premium beginner-safe succulent and cactus picks, curated for easy care in Indian homes.
          </p>

          <nav className="text-xs" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-[var(--color-text)]">
              <li><Link href="/">Home</Link></li>
              <li>&rsaquo;</li>
              <li><Link href="/collections">Collections</Link></li>
              <li>&rsaquo;</li>
              <li><Link href="/collections/beginner-friendly" aria-current="page" className="font-medium">Beginner Friendly Plant</Link></li>
            </ol>
          </nav>

          <div className="mt-6">
            <CollectionGridClient
              products={products}
              baseCollections={["succulents", "cacti"]}
              requiredTag={REQUIRED_TAG}
              productBasePath="products"
              page={page}
              totalPages={totalPages}
              pageSize={PAGE_SIZE}
            />
          </div>

          <CategoryGrid className="mt-10" excludeHrefs={["/collections/beginner-friendly"]} />

          <TrustBar />
          <RecentlyViewedProducts className="mt-6" />

          <div className="mt-8 rounded-2xl border border-[var(--auth-border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(244,238,232,0.92))] p-4 shadow-[0_16px_36px_rgba(12,20,14,0.12)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand)]">Why Beginner Friendly</p>
              <p className="text-xs text-[var(--auth-muted)]">Tap to read</p>
            </div>
            <div className="space-y-2">
              {[
                {
                  title: "Very drought tolerant",
                  description: "Handles irregular watering and missed schedules.",
                },
                {
                  title: "Hard to kill",
                  description: "Chosen for resilience against common beginner mistakes.",
                },
                {
                  title: "Indoor Indian friendly",
                  description: "Stable choices for warm rooms and everyday indoor conditions.",
                },
                {
                  title: "Medium indoor light",
                  description: "Performs well without harsh full-day direct sun.",
                },
                {
                  title: "Not sensitive to watering mistakes",
                  description: "Best fit for new plant parents building confidence with easy-care plants.",
                },
              ].map((item) => (
                <details key={item.title} className="group overflow-hidden rounded-xl border border-[var(--auth-border)] bg-white/82">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--color-text)]">
                    {item.title}
                    <ChevronDown size={16} className="text-[var(--auth-muted)] transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="border-t border-[var(--auth-border)] px-4 py-3 text-sm text-[var(--auth-muted)]">{item.description}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
