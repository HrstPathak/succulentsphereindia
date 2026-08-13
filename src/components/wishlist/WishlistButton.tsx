"use client";

import { useState, type MouseEvent } from "react";
import { Heart } from "lucide-react";
import { useWishlist } from "@/context/WishlistContext";
import type { WishlistProduct } from "@/lib/wishlist";

type Burst = {
  id: number;
  x: number;
  y: number;
};

type WishlistButtonProps = {
  product: WishlistProduct;
  className?: string;
  iconClassName?: string;
};

export default function WishlistButton({ product, className = "", iconClassName = "h-5 w-5" }: WishlistButtonProps) {
  const { isInWishlist, toggle } = useWishlist();
  const [busy, setBusy] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const active = isInWishlist(product.id);

  async function onToggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;

    const burstId = Date.now() + Math.floor(Math.random() * 1000);
    setBursts((prev) => [...prev, { id: burstId, x: event.clientX, y: event.clientY }]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((item) => item.id !== burstId));
    }, 700);

    setBusy(true);
    try {
      await toggle(product);
    } catch {
      // Error toast is handled in WishlistContext.
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={active}
        disabled={busy}
        onClick={onToggle}
        className={`relative inline-flex items-center justify-center rounded-full border border-[var(--auth-border)] bg-white/30 p-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)] disabled:opacity-60 ${className}`}
      >
        <Heart className={`${iconClassName} transition-transform duration-200 ${active ? "fill-[#7a0019] text-[#7a0019] scale-110" : "text-[var(--color-text)]"}`} />
      </button>

      {bursts.map((burst) => (
        <span key={burst.id} className="wishlist-burst" style={{ left: burst.x, top: burst.y }} aria-hidden="true">
          <Heart className="h-6 w-6 fill-[#7a0019] text-[#7a0019]" />
        </span>
      ))}
    </>
  );
}
