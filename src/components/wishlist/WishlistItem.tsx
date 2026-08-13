"use client";

import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";
import { useWishlist } from "@/context/WishlistContext";
import { showSuccessToast } from "@/lib/toast";
import type { WishlistProduct } from "@/lib/wishlist";
import PriceWithDiscount from "@/components/shared/PriceWithDiscount";

export default function WishlistItem({ item }: { item: WishlistProduct }) {
  const { remove } = useWishlist();
  const { addToCart } = useCart();
  const imageSrc = normalizeImageUrl(item.image);

  return (
    <article className="group rounded-2xl border border-[var(--auth-border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.96)_0%,rgba(244,238,232,0.92)_100%)] p-3 shadow-[0_10px_28px_rgba(12,20,14,0.1)] transition-all hover:-translate-y-0.5 sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <Link href={`/products/${item.handle}`} className="relative block h-24 w-24 overflow-hidden rounded-xl bg-white sm:h-28 sm:w-28">
          <Image src={imageSrc} alt={item.imageAlt || item.title} fill sizes="112px" className="object-cover" unoptimized={shouldBypassImageOptimization(imageSrc)} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/products/${item.handle}`} className="line-clamp-2 text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-brand)] sm:text-base">
              {item.title}
            </Link>
            <button
              type="button"
              aria-label="Remove from wishlist"
              onClick={() => remove(item.id)}
              className="rounded-full p-1.5 text-[var(--auth-muted)] hover:bg-black/5 hover:text-[#7a0019]"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-2">
            <PriceWithDiscount
              price={item.price}
              compareAtPrice={item.compareAtPrice ?? null}
              currency={item.currency}
              size="sm"
              badgePlacement="inline"
            />
          </div>
          <div className="mt-3 flex flex-nowrap items-center gap-2">
            <button
              type="button"
              disabled={!item.available}
              onClick={() => {
                addToCart(
                  { id: item.id, title: item.title, price: item.price, image: imageSrc, imageAlt: item.imageAlt || item.title, handle: item.handle },
                  1
                );
                showSuccessToast(`${item.title} added to cart`);
              }}
              className="whitespace-nowrap rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-xs font-semibold text-[var(--color-bg)] disabled:opacity-50 sm:text-sm"
            >
              {item.available ? "Add to Cart" : "Sold Out"}
            </button>
            <Link
              href={`/products/${item.handle}`}
              className="whitespace-nowrap rounded-lg border border-[var(--auth-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] sm:text-sm"
            >
              View Product
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
