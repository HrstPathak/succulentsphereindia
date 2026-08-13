import Image from "next/image";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/image-placeholder";
import { mediaAsset } from "@/lib/media";

const categories = [
  {
    title: "Succulent Plants",
    href: "/collections/succulents",
    img: mediaAsset("sites/images/9379385ad4-Category_SucculentPlant.png"),
    subtitle: "Explore collection",
    badge: "Featured",
  },
  {
    title: "Succulents at ₹39",
    href: "/collections/succulents-under-40",
    img: "/images/succulent-collection.webp",
    subtitle: "Budget-friendly succulent picks under ₹40",
    badge: "Succulents at ₹39",
  },
  {
    title: "Combo Offer",
    href: "/combo",
    img: mediaAsset("sites/images/77f60e9fdc-Succulent_combo_set_with_free_delivery.png"),
    imgPosition: "50% 35%",
    spanMobile: true,
    subtitle: "Explore collection",
    badge: "Featured",
  },
  {
    title: "Cacti Collection",
    href: "/collections/cactus",
    img: mediaAsset("sites/images/6f121b8fe3-Category_CactusCollection.webp"),
    imgPosition: "50% 30%",
    subtitle: "Explore collection",
    badge: "Featured",
  },
  {
    title: "Beginner Friendly",
    href: "/collections/beginner-friendly",
    img: mediaAsset("sites/images/1a688c970b-Category_BeginnerFriendly.png"),
    subtitle: "Explore collection",
    badge: "Featured",
  },
];

type CategoryGridProps = {
  excludeHrefs?: string[];
  className?: string;
};

function normalizeHref(href: string) {
  return href.replace(/\/+$/, "") || "/";
}

export default function CategoryGrid({ excludeHrefs = [], className = "" }: CategoryGridProps) {
  const excludedHrefSet = new Set(excludeHrefs.map(normalizeHref));
  const visibleCategories = categories.filter((category) => !excludedHrefSet.has(normalizeHref(category.href)));

  if (visibleCategories.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="shop-by-category" className={`relative overflow-hidden rounded-3xl border border-black/5 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(245,239,232,0.9))] px-4 py-10 shadow-[0_24px_60px_rgba(12,20,14,0.12)] md:px-8 md:py-12 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(8,20,28,0.9),rgba(10,16,22,0.9))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)] ${className}`.trim()}>
      <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(141,166,121,0.35),rgba(141,166,121,0))] blur-2xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(156,127,98,0.35),rgba(156,127,98,0))] blur-2xl" />

      <div className="relative mx-auto mb-8 max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-brand)]">Curated Collections</p>
        <h2 id="shop-by-category" className="mt-3 text-3xl md:text-4xl font-serif text-[var(--color-text)]">
          Shop by Category
        </h2>
        <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-[var(--auth-muted)]">
          Explore premium picks for every plant parent, from sculptural succulents to beginner-safe greens.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {visibleCategories.map((c) => (
          <a
             key={c.title}
             href={c.href}
             className={`group relative overflow-hidden rounded-2xl border border-black/5 bg-white/90 shadow-[0_14px_30px_rgba(12,20,14,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_46px_rgba(12,20,14,0.2)] dark:border-white/10 dark:bg-[#0b1722]/90 ${c.spanMobile ? "col-span-2 md:col-span-1" : ""}`}
           >
             <div className="absolute left-4 top-4 z-10 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-700 backdrop-blur-sm dark:border-white/10 dark:bg-black/30 dark:text-slate-200">
              {c.badge ?? "Featured"}
             </div>
            <div className="relative h-44 md:h-52 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700">
              <Image
                src={c.img}
                alt={c.title}
                fill
                style={{ objectFit: "cover", objectPosition: c.imgPosition ?? "center" }}
                sizes="(max-width: 768px) 50vw, 25vw"
                loading="lazy"
                placeholder="blur"
                blurDataURL={SHIMMER_BLUR_DATA_URL}
                className="transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.25))] opacity-60" />
            </div>
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <h3 className="text-sm md:text-base font-semibold text-[var(--color-text)]">{c.title}</h3>
                <p className="text-xs text-slate-600 dark:text-[var(--auth-muted)]">{c.subtitle ?? "Explore collection"}</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white text-slate-700 transition-colors duration-300 group-hover:bg-[var(--color-brand)] group-hover:text-white dark:border-white/10 dark:bg-[#0b1722] dark:text-slate-200">
                →
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

