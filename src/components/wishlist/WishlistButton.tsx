"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
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
  const { isInWishlist, toggle, isAuthenticated, loading } = useWishlist();
  const [busy, setBusy] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const active = isInWishlist(product.id);

  async function onToggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    if (loading) return;
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }

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
        disabled={busy || loading}
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

      {showLoginPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowLoginPrompt(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wishlist-login-title"
            className="w-full max-w-sm rounded-2xl border border-[var(--auth-border)] bg-[var(--color-bg)] p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Heart className="mx-auto h-8 w-8 text-[var(--color-brand)]" aria-hidden="true" />
            <h2 id="wishlist-login-title" className="mt-3 text-xl font-semibold text-[var(--color-text)]">Sign in to save your favourites</h2>
            <p className="mt-2 text-sm text-[var(--auth-muted)]">Create an account or sign in to keep your wishlist synced across your devices.</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link href="/login" className="rounded-lg border border-[var(--auth-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]" onClick={() => setShowLoginPrompt(false)}>Sign in</Link>
              <Link href="/signup" className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white" onClick={() => setShowLoginPrompt(false)}>Create account</Link>
            </div>
            <button type="button" className="mt-4 text-sm text-[var(--auth-muted)] underline" onClick={() => setShowLoginPrompt(false)}>Continue browsing</button>
          </div>
        </div>
      )}
    </>
  );
}
