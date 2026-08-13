import type { Metadata } from "next";
import Link from "next/link";
import TrustBar from "../../components/TrustBar";
import CollectionCards from "../../components/collections/CollectionCards";
import { mediaAsset } from "@/lib/media";

export const metadata: Metadata = {
  title: {
    absolute: "Shop Succulent & Cactus Collections Online India | Succulent Sphere",
  },
  description:
    "Shop premium succulent plants, cacti, and beginner-friendly collections online in India. Handpicked varieties, safe shipping, and curated picks for every home.",
  alternates: {
    canonical: "/collections",
  },
};

const COLLECTIONS = [
  {
    id: "succulents",
    name: "Succulent Plants",
    description: "Handpicked premium succulents to enrich your home and workspace.",
    image: "/images/succulent-collection.webp",
    color: "#577a66",
    vibe: "Calm and sculptural",
  },
  {
    id: "cacti",
    name: "Cacti Collection",
    description: "Unique desert cacti with stunning shapes and colors.",
    image: "/images/Cactus-Collection.webp",
    color: "#8fa366",
    vibe: "Bold and architectural",
    href: "/collections/cactus",
  },
  {
    id: "beginner-friendly",
    name: "Beginner Friendly Plant",
    description: "Easy-care succulent and cactus picks for first-time plant parents.",
    image: mediaAsset("sites/images/1a688c970b-Category_BeginnerFriendly.png"),
    color: "#6f8b6a",
    vibe: "Forgiving and beginner-safe",
    href: "/collections/beginner-friendly",
  },
  {
    id: "pots",
    name: "Pots Collection",
    description: "Elegant pots for premium plant styling.",
    image: "/images/pots-Collection.webp",
    color: "#8e8068",
    vibe: "Minimal and modern",
  },
  {
    id: "gift-collection",
    name: "Gift Collection",
    description: "Ready-to-gift plant combos and curated green hampers.",
    image: "/images/gift-collection.webp",
    color: "#6f7f66",
    vibe: "Celebratory and warm",
  },
  {
    id: "air-purifier",
    name: "Air Purifier",
    description: "Air-purifying plants curated for healthier interiors.",
    image: "/images/Air-Purifier.webp",
    color: "#648073",
    vibe: "Fresh and restorative",
  },
];

function buildBreadcrumbJson() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://succulentsphere.com" },
      { "@type": "ListItem", position: 2, name: "Collections", item: "https://succulentsphere.com/collections" },
    ],
  };
}

function buildCollectionsItemListJson() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Succulent Sphere Collections",
    itemListElement: COLLECTIONS.map((collection, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: collection.name,
      url: `https://succulentsphere.com${collection.href || `/collections/${collection.id}`}`,
    })),
  };
}

export default function CollectionsPage() {
  const breadcrumbJson = buildBreadcrumbJson();
  const collectionsItemListJson = buildCollectionsItemListJson();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionsItemListJson) }} />

      <section className="min-h-screen bg-[var(--color-bg)] py-10 md:py-12">
        <div className="container mx-auto px-4">
          <div className="mb-12 mt-4 text-center">
            <h1 className="mx-auto max-w-3xl text-[var(--color-text)]">
              <span className="mb-4 block text-4xl font-serif md:text-6xl">Collections</span>
              <span className="mx-auto block max-w-3xl text-base font-normal text-slate-700 dark:text-[var(--auth-muted)]">
                Explore our carefully curated collections of premium plants, from classic succulents to rare exotics.
              </span>
            </h1>
          </div>

          <nav className="mb-8 text-xs" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-[var(--color-text)]">
              <li><Link href="/">Home</Link></li>
              <li>&rsaquo;</li>
              <li><Link href="/collections" aria-current="page" className="font-medium">Collections</Link></li>
            </ol>
          </nav>

          <div className="rounded-3xl border border-black/5 bg-white/80 p-3 shadow-[0_16px_52px_rgba(10,18,14,0.1)] backdrop-blur-sm md:p-4 dark:border-white/10 dark:bg-[#0b1722]/80 dark:shadow-[0_16px_52px_rgba(0,0,0,0.45)]">
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-black/5 bg-[linear-gradient(135deg,rgba(250,252,249,0.95),rgba(243,248,244,0.92))] px-4 py-3 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(8,20,28,0.92),rgba(6,16,22,0.92))]">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-900/70 dark:text-[var(--auth-muted)]">Browse by Theme</p>
              <p className="text-xs text-slate-600 dark:text-[var(--auth-muted)]">{COLLECTIONS.length} collections</p>
            </div>

            <CollectionCards collections={COLLECTIONS} />
          </div>

          <div className="mx-auto mt-10 max-w-5xl rounded-2xl border border-[var(--auth-border)] bg-[linear-gradient(150deg,rgba(255,255,255,0.94),rgba(244,238,232,0.9))] p-6 shadow-[0_16px_38px_rgba(12,20,14,0.1)] md:p-8 dark:border-white/10 dark:bg-[linear-gradient(150deg,rgba(8,20,28,0.94),rgba(6,16,22,0.9))] dark:shadow-[0_16px_38px_rgba(0,0,0,0.45)]">
            <p className="text-sm leading-7 text-[var(--color-text)]/85 md:text-base">
              Browse handpicked succulent and cactus collections, curated for Indian homes.
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--color-text)]/85 md:text-base">
              Whether you're a first-time plant parent or a seasoned collector, every collection at Succulent Sphere is selected for
              health, shape, and shelf appeal. From low-maintenance beginner-friendly succulents to bold architectural cacti - each
              plant is packed for safe doorstep delivery across India. Explore our gifting sets for ready-to-gift green hampers, or
              shop elegant pots designed specifically for succulent styling.
            </p>
          </div>

          <div className="mt-10">
            <TrustBar />
          </div>
        </div>
      </section>
    </>
  );
}
