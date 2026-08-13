import Image from "next/image";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { getDiscountPercent } from "@/lib/discount";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/image-placeholder";

export type BestSellerProduct = {
  id: string;
  title: string;
  handle: string;
  image: string;
  imageAlt?: string;
  price: string;
  compareAtPrice?: string | null;
  currency?: string;
  badge?: string;
  rating?: number;
};

export default function BestSellerGrid({ products }: { products: BestSellerProduct[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      {products.map((p) => {
        const currency = p.currency || "INR";
        const discountPercent = getDiscountPercent(p.price, p.compareAtPrice ?? null);

        return (
          <article
            key={p.id}
            className="bg-white dark:bg-[#0a1420] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:-translate-y-1"
          >
            <div className="relative h-48 md:h-56 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 overflow-hidden group">
              <Image
                src={p.image || "/assets/product-1.jpg"}
                alt={p.imageAlt || p.title}
                fill
                style={{ objectFit: "cover" }}
                sizes="(max-width: 768px) 50vw, 25vw"
                loading="lazy"
                placeholder="blur"
                blurDataURL={SHIMMER_BLUR_DATA_URL}
                className="group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute top-3 right-3 bg-[var(--color-brand)] text-white px-3 py-1 rounded-full text-xs font-semibold ring-2 ring-white/80">
                {p.badge || "Best Seller"}
              </div>
            </div>
            <div className="p-5">
              <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-[var(--color-text)] md:text-base">{p.title}</h3>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-[var(--color-brand)]">
                      {formatCurrency(p.price, currency)}
                    </span>
                    {discountPercent ? (
                      <span className="text-[11px] text-slate-500 line-through dark:text-[var(--auth-muted)]">
                        {formatCurrency(p.compareAtPrice ?? "", currency)}
                      </span>
                    ) : null}
                  </div>
                  {discountPercent ? (
                    <div className="mt-1">
                      <span className="inline-flex items-center rounded-full border border-emerald-200/70 bg-[linear-gradient(135deg,#0f766e,#22c55e)] px-2 py-0.5 text-[9px] font-semibold text-white shadow-[0_8px_16px_rgba(15,118,110,0.28)]">
                        {discountPercent}% OFF
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-1" aria-label="5 star rating">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-xs text-yellow-400">
                      &#9733;
                    </span>
                  ))}
                </div>
              </div>
              <Link
                href={`/products/${p.handle}`}
                className="w-full block text-center bg-[var(--color-brand)] hover:brightness-110 text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
              >
                View Details
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
