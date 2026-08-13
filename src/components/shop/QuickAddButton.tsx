"use client";
import { useCart } from "../../context/CartContext";
import type { Product } from "../../data/mockProducts";
import { showSuccessToast } from "../../lib/toast";
import { resolveProductImageAlt } from "@/lib/imageAlt";

export default function QuickAddButton({
  product,
  setAdding,
  adding,
  disabled = false
}: {
  product: Product;
  setAdding: (b: boolean) => void;
  adding: boolean;
  disabled?: boolean;
}) {
  const { addToCart } = useCart();
  const productTags = Array.isArray((product as { tags?: string[] }).tags)
    ? (product as { tags?: string[] }).tags
    : [];
  const cartItem = {
    id: String(product.id ?? ""),
    title: product.title || "Untitled Product",
    price: String(product.price ?? "0.00"),
    image: product.image || "/assets/product-1.jpg",
    imageAlt: resolveProductImageAlt((product as { imageAlt?: string }).imageAlt),
    handle: product.handle || "",
    tags: productTags,
  };

  return (
    <button
      className={`w-full rounded py-2 text-sm font-medium transition ${
        disabled
          ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-white/40"
          : "bg-white text-[var(--color-brand)] dark:bg-white/10 dark:text-[var(--color-text)] dark:border dark:border-white/10"
      }`}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        setAdding(true);
        addToCart(
          {
            id: product.id,
            title: product.title,
            price: product.price,
            image: product.image,
            imageAlt: resolveProductImageAlt((product as { imageAlt?: string }).imageAlt),
            handle: product.handle,
            tags: productTags,
          },
          1
        );
        showSuccessToast(`${product.title} added to cart`);
        setTimeout(() => setAdding(false), 800);
      }}
      aria-label={disabled ? `${product.title} is sold out` : `Add ${product.title} to cart`}
    >
      {disabled ? "Sold Out" : adding ? "Adding..." : "Quick Add"}
    </button>
  );
}
