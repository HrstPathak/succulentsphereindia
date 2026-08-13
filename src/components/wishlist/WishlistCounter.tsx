"use client";

import { useWishlist } from "@/context/WishlistContext";

export default function WishlistCounter({ className = "", inline = false }: { className?: string; inline?: boolean }) {
  const { count } = useWishlist();
  if (!count) return null;

  return (
    <span
      className={`${inline ? "inline-flex" : "absolute -right-1 -top-1 inline-flex"} min-h-4 min-w-4 items-center justify-center rounded-full bg-[#7a0019] px-1 text-[10px] font-semibold text-white ${className}`}
      aria-label={`${count} wishlist items`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
