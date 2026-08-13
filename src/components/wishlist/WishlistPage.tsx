"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useWishlist } from "@/context/WishlistContext";
import WishlistItem from "./WishlistItem";

export default function WishlistPage() {
  const { products, count, loading } = useWishlist();

  return (
    <section className="auth-shell-bg min-h-screen bg-[var(--color-bg)] px-4 pb-16 pt-8" style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}>
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[28px] border border-[var(--auth-border)] bg-[linear-gradient(145deg,#f7f2ed_0%,#efe7df_100%)] p-4 shadow-[0_20px_55px_rgba(12,20,14,0.14)] sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--auth-muted)]">Your Collection</p>
              <h1 className="mt-1 font-serif text-4xl text-[var(--color-text)]">Wishlist</h1>
              <p className="mt-2 text-sm text-[var(--auth-muted)]">
                {count} {count === 1 ? "item" : "items"} saved for later.
              </p>
            </div>
            <Link href="/collections" className="rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-semibold text-[var(--color-bg)]">
              Continue Shopping
            </Link>
          </div>

          {loading ? (
            <div className="mt-8 rounded-2xl border border-[var(--auth-border)] bg-white/60 p-8 text-center text-sm text-[var(--auth-muted)]">Loading wishlist...</div>
          ) : products.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-[var(--auth-border)] bg-white/60 p-8 text-center">
              <Heart className="mx-auto h-8 w-8 text-[var(--color-brand)]" />
              <p className="mt-3 text-base font-medium text-[var(--color-text)]">Your wishlist is empty</p>
              <p className="mt-1 text-sm text-[var(--auth-muted)]">Tap the heart on any product to save it here.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {products.map((item) => (
                <WishlistItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
