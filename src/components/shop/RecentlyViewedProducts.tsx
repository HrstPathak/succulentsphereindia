"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";
import { getRecentlyViewedProducts, type RecentlyViewedProduct } from "@/lib/recentlyViewed";
import PriceWithDiscount from "@/components/shared/PriceWithDiscount";

type Props = {
  className?: string;
};

export default function RecentlyViewedProducts({ className = "" }: Props) {
  const [items, setItems] = useState<RecentlyViewedProduct[]>([]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollHints() {
    const node = scrollerRef.current;
    if (!node) return;
    const maxLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    setCanScrollLeft(node.scrollLeft > 4);
    setCanScrollRight(node.scrollLeft < maxLeft - 4);
  }

  useEffect(() => {
    setItems(getRecentlyViewedProducts());
  }, []);

  useEffect(() => {
    updateScrollHints();
    const onResize = () => updateScrollHints();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [items]);

  function scrollByAmount(direction: "left" | "right") {
    const node = scrollerRef.current;
    if (!node) return;
    const amount = Math.max(180, Math.floor(node.clientWidth * 0.7));
    node.scrollBy({ left: direction === "right" ? amount : -amount, behavior: "smooth" });
  }

  if (items.length === 0) return null;

  return (
    <section className={className} aria-label="Recently viewed products">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Recently Viewed Products</h2>
        <span className="text-xs font-medium text-[var(--auth-muted)]">Up to 8 products</span>
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          onScroll={updateScrollHints}
          className="overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-max gap-3">
          {items.map((item) => {
            const imageSrc = normalizeImageUrl(item.image);
            return (
              <Link
                key={`${item.id}-${item.handle}`}
                href={`/products/${item.handle}`}
                className="group block w-[170px] shrink-0 overflow-hidden rounded-xl border border-[var(--auth-border)] bg-white shadow-[0_8px_20px_rgba(13,27,21,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(13,27,21,0.18)] dark:border-white/10 dark:bg-[#0b1722] dark:shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
              >
                <div className="relative h-[130px] w-full bg-[var(--color-bg)]">
                  <Image
                    src={imageSrc}
                    alt={item.title}
                    fill
                    sizes="170px"
                    unoptimized={shouldBypassImageOptimization(imageSrc)}
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-[var(--color-text)]">{item.title}</p>
                  <div className="mt-1">
                    <PriceWithDiscount
                      price={item.price}
                      compareAtPrice={item.compareAtPrice ?? null}
                      currency={item.currency || "INR"}
                      size="sm"
                      badgePlacement="inline"
                      showBadge={false}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
          </div>
        </div>

        {canScrollLeft && (
          <button
            type="button"
            aria-label="Scroll recently viewed left"
            onClick={() => scrollByAmount("left")}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/95 p-1.5 text-[var(--color-brand)] shadow-[0_8px_18px_rgba(13,27,21,0.2)] dark:border-white/20 dark:bg-black/35 dark:shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {canScrollRight && (
          <button
            type="button"
            aria-label="Scroll recently viewed right"
            onClick={() => scrollByAmount("right")}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/95 p-1.5 text-[var(--color-brand)] shadow-[0_8px_18px_rgba(13,27,21,0.2)] dark:border-white/20 dark:bg-black/35 dark:shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}
