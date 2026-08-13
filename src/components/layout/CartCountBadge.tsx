"use client";
import { useCart } from "../../context/CartContext";

export default function CartCountBadge() {
  const { count } = useCart();
  if (!count) return null;
  return (
    <span className="absolute -top-1 -right-1 bg-[var(--color-accent)] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
      {count}
    </span>
  );
}

