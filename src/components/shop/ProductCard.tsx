"use client";

import Image from "next/image";
import type { Product } from "../../data/mockProducts";
import { useState } from "react";
import Link from "next/link";
import QuickAddButton from "./QuickAddButton";
import { useCart } from "../../context/CartContext";
import { showSuccessToast } from "../../lib/toast";
import WishlistButton from "../wishlist/WishlistButton";
import { FREE_SHIPPING_TAGS } from "@/lib/pricing";
import { resolveProductImageAlt } from "@/lib/imageAlt";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";
import PriceWithDiscount from "@/components/shared/PriceWithDiscount";
import { getDiscountPercent } from "@/lib/discount";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/image-placeholder";

export default function ProductCard({
  product,
  collectionHandle = "",
  productBasePath = "collections",
  wishlistPlacement = "image",
  hideComboTag = false,
}: {
  product: Product;
  collectionHandle?: string;
  productBasePath?: "collections" | "products";
  wishlistPlacement?: "image" | "meta" | "none";
  hideComboTag?: boolean;
}) {
  void hideComboTag;
  const [adding, setAdding] = useState(false);
  const { addToCart } = useCart();
  const stableProductId = String(product.id || product.handle || "").trim();
  const reviewCount = Number((product as { reviewCount?: number }).reviewCount || 0);
  const ratingValue = typeof product.rating === "number" && Number.isFinite(product.rating) ? product.rating : null;
  const hasReviews = reviewCount > 0 && ratingValue !== null;
  const quantityValue = Number(
    (product as { quantity?: number; inventoryQuantity?: number; totalInventory?: number }).quantity ??
      (product as { inventoryQuantity?: number }).inventoryQuantity ??
      (product as { totalInventory?: number }).totalInventory
  );
  const hasQuantity = Number.isFinite(quantityValue);
  const availabilityValue = String((product as { availability?: string }).availability || "");
  const normalizedAvailability = availabilityValue.replace(/\s+/g, "").toLowerCase();
  const badgeValue = String((product as { badge?: string }).badge || "");
  const normalizedBadge = badgeValue.toLowerCase();
  const availableFlag = (product as { available?: boolean }).available;
  const isOutOfStock = hasQuantity
    ? quantityValue <= 0 && availableFlag === false
    : availableFlag === false ||
      normalizedAvailability === "outofstock" ||
      normalizedAvailability === "soldout" ||
      normalizedBadge === "out of stock" ||
      normalizedBadge === "sold out";
  const stockLabel = isOutOfStock ? "Sold Out" : "In Stock";
  const productTags = Array.isArray((product as { tags?: string[] }).tags)
    ? (product as { tags?: string[] }).tags
    : [];
  const productTypeRaw = String(
    (product as { productType?: string; type?: string }).productType ||
      (product as { type?: string }).type ||
      ""
  );
  const isComboType = productTypeRaw.trim().toLowerCase() === "combo";
  const normalizedTags = productTags.map((tag) => String(tag || "").trim().toLowerCase());
  const hasFreeShippingTag = FREE_SHIPPING_TAGS.some((tag) =>
    normalizedTags.includes(String(tag || "").trim().toLowerCase())
  );
  const showFreeDeliveryLabel = isComboType && hasFreeShippingTag;
  const showWishlistOnImage = wishlistPlacement === "image";
  const showWishlistInMeta = wishlistPlacement === "meta";
  const compareAtPrice = (product as { compareAtPrice?: string | null }).compareAtPrice ?? null;
  const currency = String((product as { currency?: string }).currency || "INR");
  const productImage = normalizeImageUrl(product.image);
  const stockPillClass = isOutOfStock
    ? "inline-flex bg-slate-200 text-slate-600"
    : "inline-flex bg-[var(--color-secondary)]/20 text-[var(--color-brand)]";
  const showStockPill = isOutOfStock || !compareAtPrice;

  const productHref =
    productBasePath === "products"
      ? product.handle
        ? `/products/${product.handle}`
        : "/shop"
      : product.handle
      ? collectionHandle
        ? `/collections/${collectionHandle}/${product.handle}`
        : `/products/${product.handle}`
      : collectionHandle
      ? `/collections/${collectionHandle}`
      : "/collections";

  const cartItem = {
    id: stableProductId,
    title: product.title || "Untitled Product",
    price: String(product.price ?? "0.00"),
    image: productImage,
    imageAlt: resolveProductImageAlt((product as { imageAlt?: string }).imageAlt),
    handle: product.handle || "",
    tags: productTags,
  };

  const wishlistProduct = {
    id: stableProductId,
    title: product.title || "Untitled Product",
    handle: product.handle || "",
    image: productImage,
    imageAlt: resolveProductImageAlt((product as { imageAlt?: string }).imageAlt),
    price: String(product.price ?? "0.00"),
    compareAtPrice,
    currency: String((product as { currency?: string }).currency || "INR"),
    available: !isOutOfStock,
  };
  const discountPercent = getDiscountPercent(product.price, compareAtPrice);
  const badgePositionClass =
    typeof discountPercent === "number" && discountPercent > 0 ? "right-3 left-auto" : "left-3";

  return (
    <Link href={productHref} aria-label={`View ${product.title} details`} className="group">
      <article
        className="overflow-hidden rounded-2xl border border-[var(--auth-border)] bg-[linear-gradient(145deg,rgba(255,255,255,0.98)_0%,rgba(244,238,232,0.94)_100%)] shadow-[0_10px_28px_rgba(12,20,14,0.12)] transition-all duration-300 md:group-hover:-translate-y-1 md:group-hover:shadow-[0_20px_42px_rgba(12,20,14,0.2)] dark:border-white/15 dark:bg-[linear-gradient(145deg,rgba(12,28,40,0.55)_0%,rgba(9,20,28,0.35)_100%)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.55)] dark:backdrop-blur-xl"
        tabIndex={0}
        aria-labelledby={`product-${product.id}`}
      >
        <div
          className="relative w-full overflow-hidden bg-[radial-gradient(circle_at_25%_22%,rgba(163,177,138,0.28),transparent_50%),linear-gradient(160deg,#f8f4ef_0%,#eee4d8_100%)] dark:bg-[radial-gradient(circle_at_25%_22%,rgba(143,191,148,0.18),transparent_50%),linear-gradient(160deg,#0d1a24_0%,#0a141d_100%)]"
          style={{ paddingTop: "100%" }}
        >
          <Image
            src={productImage}
            alt={resolveProductImageAlt((product as { imageAlt?: string }).imageAlt)}
            fill
            style={{ objectFit: "cover" }}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
            placeholder="blur"
            blurDataURL={SHIMMER_BLUR_DATA_URL}
            unoptimized={shouldBypassImageOptimization(productImage)}
            className="transition-transform duration-500 md:group-hover:scale-110"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/38 via-black/2 to-transparent opacity-70" />

          {product.badge && normalizedBadge !== "combo" && (
            <span
              className={`absolute top-3 ${badgePositionClass} rounded-full bg-[linear-gradient(90deg,#355b48_0%,#6d8d63_100%)] px-3 py-1 text-xs font-semibold text-white shadow-lg`}
            >
              {product.badge}
            </span>
          )}

          {typeof discountPercent === "number" && discountPercent > 0 && (
            <div className="pointer-events-none absolute left-[-20px] top-[-35px] z-20 w-20 h-12">
              <Image
                src="/images/DiscountBadge.png"
                alt={`${Math.round(discountPercent)}% off`}
                fill
                sizes="56px"
                className="object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.32)] !h-24"
              />
              <span className="absolute left-[29px] top-[40px] text-[9px] font-bold uppercase leading-[1.05] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] sm:text-[10px]">
                {Math.round(discountPercent)}%
                <span className="block text-[9px] font-semibold sm:text-[9px]">Off</span>
              </span>
            </div>
          )}

          {showWishlistOnImage && (
            <div className="absolute right-2 top-2 z-20">
              <WishlistButton
                product={wishlistProduct}
                className="border-white/40 bg-white/30 shadow-[0_8px_20px_rgba(0,0,0,0.16)] backdrop-blur dark:border-white/20 dark:bg-white/10 dark:shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
              />
            </div>
          )}

          {!isComboType && hasReviews && (
            <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 shadow-md backdrop-blur dark:bg-black/40">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)]">
                {ratingValue.toFixed(1)}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="h-3.5 w-3.5 fill-current text-amber-500"
                >
                  <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 14.76 4.8 17.5l.99-5.79-4.21-4.1 5.82-.85L10 1.5z" />
                </svg>
              </span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 flex items-end bg-black/22 p-4 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 md:group-hover:pointer-events-auto md:group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
            <div className="w-full text-white">
              <div className="mb-3 flex items-center justify-between">
                {reviewCount > 0 ? <span className="text-sm font-semibold">{reviewCount} reviews</span> : <span />}
              </div>
              <QuickAddButton product={product} setAdding={setAdding} adding={adding} disabled={isOutOfStock} />
            </div>
          </div>
        </div>

        <div className="p-4">
          <h3
            id={`product-${product.id}`}
            className="mb-1.5 line-clamp-2 text-[13px] font-semibold text-[var(--color-text)] transition group-hover:text-[var(--color-brand)] sm:mb-2 sm:text-sm"
          >
            {product.title}
          </h3>

          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PriceWithDiscount
                price={product.price}
                compareAtPrice={compareAtPrice}
                currency={currency}
                size="md"
                badgePlacement="inline"
                showBadge={false}
              />
              {showWishlistInMeta && !isOutOfStock ? (
                <WishlistButton
                  product={wishlistProduct}
                  iconClassName="h-4 w-4"
                  className="border-[var(--auth-border)] bg-white/30 p-1.5 shadow-sm hover:shadow-md dark:border-white/15 dark:bg-white/10"
                />
              ) : showStockPill ? (
                <div
                  className={`rounded-full px-2 py-0.5 text-[10px] sm:text-xs ${stockPillClass}`}
                >
                  {stockLabel}
                </div>
              ) : null}
            </div>
            {showFreeDeliveryLabel && (
              <div className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800 sm:text-[10px]">
                Free Delivery
              </div>
            )}

            <button
              className={`w-full rounded-lg py-2 text-[13px] font-semibold shadow-[0_8px_18px_rgba(52,78,65,0.2)] transition-all sm:py-2.5 sm:text-sm ${
                isOutOfStock
                  ? "cursor-not-allowed bg-slate-200 text-slate-600"
                  : "bg-[linear-gradient(45deg,#047857,#059669)] text-[var(--color-bg)] active:scale-95 md:hover:-translate-y-0.5 md:hover:shadow-[0_14px_26px_rgba(52,78,65,0.26)]"
              }`}
              disabled={isOutOfStock}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (isOutOfStock) return;
                setAdding(true);
                addToCart(cartItem, 1);
                showSuccessToast(`${product.title} added to cart`);
                setTimeout(() => setAdding(false), 800);
              }}
              aria-label={isOutOfStock ? `${product.title} is sold out` : `Add ${product.title} to cart`}
            >
              {isOutOfStock ? "Sold Out" : adding ? "Adding..." : "Add to Cart"}
            </button>
          </div>
        </div>
      </article>
    </Link>
  );
}


