"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useWishlist } from "@/context/WishlistContext";
import type { WishlistProduct } from "@/lib/wishlist";
import WishlistItem from "./WishlistItem";

/**
 * Placeholder rows sized like the real cards, so resolving the saved products
 * never shifts the layout (same approach as src/app/account/loading.tsx).
 */
function WishlistSkeletonRow() {
  return (
    <article className="rounded-2xl border border-[var(--auth-border)] bg-white/60 p-3 sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <div className="ss-skeleton h-24 w-24 shrink-0 rounded-xl sm:h-28 sm:w-28" />
        <div className="min-w-0 flex-1">
          <div className="ss-skeleton ss-skeleton-strong h-5 w-4/5 rounded-md" />
          <div className="ss-skeleton mt-3 h-4 w-24 rounded-md" />
          <div className="mt-4 flex gap-2">
            <div className="ss-skeleton h-8 w-28 rounded-lg" />
            <div className="ss-skeleton h-8 w-24 rounded-lg" />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function WishlistPage({
  initialProducts = [],
  initialResolved = false,
}: {
  /** Server-rendered snapshot for signed-in shoppers (empty for guests). */
  initialProducts?: WishlistProduct[];
  /** True when the server already resolved the signed-in wishlist. */
  initialResolved?: boolean;
}) {
  const { products, count, loading, isAuthenticated } = useWishlist();

  // Signed-in shoppers get their saved products from the server render, so the
  // grid paints on the first frame instead of flashing a second loading state
  // while the live wishlist request is still in flight.
  const showInitial = loading && initialResolved && !isAuthenticated;
  const visibleProducts = showInitial ? initialProducts : products;
  const visibleCount = showInitial ? initialProducts.length : count;
  const showSkeleton = loading && !showInitial;

  return (
    <section className="auth-shell-bg min-h-screen bg-[var(--color-bg)] px-4 pb-16 pt-8" style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}>
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[28px] border border-[var(--auth-border)] bg-[linear-gradient(145deg,#f7f2ed_0%,#efe7df_100%)] p-4 shadow-[0_20px_55px_rgba(12,20,14,0.14)] sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--auth-muted)]">Your Collection</p>
              <h1 className="mt-1 font-serif text-4xl text-[var(--color-text)]">Wishlist</h1>
              <p className="mt-2 text-sm text-[var(--auth-muted)]">
                {visibleCount} {visibleCount === 1 ? "item" : "items"} saved for later.
              </p>
            </div>
            <Link href="/collections" className="rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-semibold text-[var(--color-bg)]">
              Continue Shopping
            </Link>
          </div>

          {showSkeleton ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2" role="status" aria-busy="true" aria-label="Loading your wishlist">
              <span className="sr-only">Loading your wishlist…</span>
              {Array.from({ length: 4 }).map((_, index) => (
                <WishlistSkeletonRow key={index} />
              ))}
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-[var(--auth-border)] bg-white/60 p-8 text-center">
              <Heart className="mx-auto h-8 w-8 text-[var(--color-brand)]" />
              <p className="mt-3 text-base font-medium text-[var(--color-text)]">Your wishlist is empty</p>
              <p className="mt-1 text-sm text-[var(--auth-muted)]">Tap the heart on any product to save it here.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {visibleProducts.map((item) => (
                <WishlistItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
