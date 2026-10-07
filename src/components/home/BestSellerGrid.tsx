"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SafeProductImage from "@/components/shared/SafeProductImage";
import { formatCurrency } from "@/lib/currency";
import { getDiscountPercent } from "@/lib/discount";

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
  const [startIndex, setStartIndex] = useState(0);
  const [tabVisible, setTabVisible] = useState(true);
  const pool = useMemo(() => products.filter(Boolean).slice(0, 20), [products]);

  // Skip re-render work for the off-screen carousel while the tab is hidden.
  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (pool.length <= 4 || !tabVisible) return;
    const interval = window.setInterval(() => {
      setStartIndex((current) => (current + 4) % pool.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [pool.length, tabVisible]);

  const visibleProducts = useMemo(() => {
    if (!pool.length) return [];
    if (pool.length <= 4) return pool;
    const next = [] as BestSellerProduct[];
    for (let offset = 0; offset < 4; offset += 1) {
      const index = (startIndex + offset) % pool.length;
      next.push(pool[index]);
    }
    return next;
  }, [pool, startIndex]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      {visibleProducts.map((p) => {
        const currency = p.currency || "INR";
        const discountPercent = getDiscountPercent(p.price, p.compareAtPrice ?? null);

        return (
          <Link
            key={p.id}
            href={`/products/${p.handle}`}
            aria-label={`View ${p.title} details`}
            className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0a1420]"
          >
            <article className="flex h-full flex-col bg-white dark:bg-[#0a1420] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:-translate-y-1">
              <div className="relative h-48 md:h-56 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 overflow-hidden">
                <SafeProductImage
                  src={p.image || "/assets/product-1.jpg"}
                  alt={p.imageAlt || p.title}
                  sizes="(max-width: 768px) 50vw, 25vw"
                  style={{ objectFit: "cover" }}
                  className="group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 bg-[var(--color-brand)] text-white px-3 py-1 rounded-full text-xs font-semibold ring-2 ring-white/80">
                  {p.badge || "Best Seller"}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold text-[var(--color-text)] md:text-base">{p.title}</h3>

                <div className="mb-2.5 flex items-center gap-1" aria-label="5 star rating">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-[11px] leading-none text-yellow-400">
                      &#9733;
                    </span>
                  ))}
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
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
                    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[linear-gradient(135deg,#059669_0%,#10b981_100%)] px-2.5 py-1 text-[10px] font-bold tracking-[0.04em] text-white shadow-[0_6px_14px_rgba(16,185,129,0.3)]">
                      {discountPercent}% OFF
                    </span>
                  ) : null}
                </div>

                <span className="mt-auto block w-full rounded-lg bg-[var(--color-brand)] px-3 py-2.5 text-center text-sm font-medium text-white transition-all duration-200 hover:brightness-110 group-hover:brightness-110">
                  View Details
                </span>
              </div>
            </article>
          </Link>
        );
      })}
    </div>
  );
}
