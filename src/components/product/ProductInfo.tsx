"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Droplets, ShoppingBag, Star, SunMedium } from "lucide-react";
import QuantitySelector from "./QuantitySelector";
import { useCart } from "../../context/CartContext";
import { showSuccessToast } from "../../lib/toast";
import WishlistButton from "../wishlist/WishlistButton";
import { resolveProductImageAlt } from "@/lib/imageAlt";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";
import PincodeServiceabilityCard from "@/components/shared/PincodeServiceabilityCard";
import ProductReviewsSection from "@/components/reviews/ProductReviewsSection";
import PriceWithDiscount from "@/components/shared/PriceWithDiscount";

function htmlToPlainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function getCareGuideLines(product: any): string[] {
  const descriptionText = typeof product?.description === "string" ? product.description : "";
  const descriptionHtml = typeof product?.descriptionHtml === "string" ? product.descriptionHtml : "";
  const source = descriptionText.trim() || htmlToPlainText(descriptionHtml);
  if (!source) return [];

  const lines = source.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  const careGuideIndex = lines.findIndex((line) => /care\s*guide/i.test(line));
  if (careGuideIndex < 0) return [];

  return lines
    .slice(careGuideIndex + 1)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function extractLightAndWater(product: any) {
  const fallback = {
    light: "Bright Indirect Light",
    water: "Water every 2 weeks",
  };

  const lines = getCareGuideLines(product);
  if (lines.length === 0) return fallback;

  const lightLine = lines.find((line) => /(^|\b)(light|sunlight|sun)\b/i.test(line));
  const waterLine = lines.find((line) => /(^|\b)(water|watering)\b/i.test(line));

  const clean = (value?: string) =>
    value
      ? value.replace(/^((light|sunlight|sun|water|watering)\s*:?\s*)/i, "").trim()
      : "";

  const light = clean(lightLine) || fallback.light;
  const water = clean(waterLine) || fallback.water;
  return { light, water };
}

export default function ProductInfo({ product, tabsSlot }: { product: any; tabsSlot?: ReactNode }) {
  const [qty, setQty] = useState(1);
  const { addToCart } = useCart();
  const careSignals = useMemo(() => extractLightAndWater(product), [product]);
  const reviewCount = Number(product?.reviewCount || 0);
  const ratingValue = Number(product?.rating || 0);
  const hasReviews = reviewCount > 0 && Number.isFinite(ratingValue) && ratingValue > 0;
  const quantityValue = Number(product?.quantity ?? product?.inventoryQuantity ?? 0);
  const hasQuantity = Number.isFinite(quantityValue);
  const availableFlag = product?.available;
  const statusValue = String(product?.status || "").trim().toLowerCase();
  const availabilityValue = String(product?.availability || "").trim().toLowerCase();
  const isOutOfStock =
    availableFlag === false ||
    statusValue === "sold out" ||
    statusValue === "out of stock" ||
    availabilityValue === "outofstock" ||
    availabilityValue === "soldout" ||
    (hasQuantity && quantityValue <= 0);
  const productTags = Array.isArray(product?.tags) ? product.tags : [];
  const compareAtPrice = product?.compareAtPrice ?? null;
  const currency = String(product?.currency || "INR");
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const wishlistProduct = {
    id: String(product?.id || ""),
    title: String(product?.title || "Untitled"),
    handle: String(product?.handle || ""),
    image: normalizeImageUrl(product?.image || product?.images?.[0], "/images/succulent-collection.webp"),
    imageAlt: resolveProductImageAlt(product?.imageAlt),
    price: String(product?.price || "0.00"),
    compareAtPrice: product?.compareAtPrice ?? null,
    currency: String(product?.currency || "INR"),
    available: !isOutOfStock,
  };

  useEffect(() => {
    const target = ctaRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyCta(!entry.isIntersecting);
      },
      { threshold: 0.2 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 120);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const offset = showStickyCta && hasScrolled ? "160px" : "0px";
    root.style.setProperty("--sticky-cta-offset", offset);
    return () => {
      root.style.removeProperty("--sticky-cta-offset");
    };
  }, [showStickyCta, hasScrolled]);

  return (
    <div>
      <div className="mb-5">
        {product.badge && (
          <span className="inline-block rounded bg-[var(--color-accent)] px-3 py-1 text-xs text-[var(--color-bg)] mb-2">
            {product.badge}
          </span>
        )}
        <h1 className="mb-2 text-3xl text-[var(--color-text)]">{product.title}</h1>
        {hasReviews ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-[var(--auth-muted)]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f3ede3] px-2.5 py-1 font-semibold text-[#355b48]">
              {ratingValue.toFixed(1)}
              <Star className="h-3.5 w-3.5 fill-current text-amber-500" strokeWidth={1.8} />
            </span>
            <span>
              {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
            </span>
          </div>
        ) : null}
        {false ? (
          <p className="mb-2 text-sm text-[var(--auth-muted)]">
            {ratingValue.toFixed(1)} • {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
          </p>
        ) : null}
        <div className="mb-4">
          <PriceWithDiscount
            price={product.price}
            compareAtPrice={compareAtPrice}
            currency={currency}
            size="lg"
            badgePlacement="inline"
            priceClassName="text-[var(--color-text)]"
            badgeVariant="off"
            badgeClassName="uppercase tracking-[0.08em] !border-emerald-200/70 !bg-[linear-gradient(135deg,#176a4a,#2fbf7a)] shadow-[0_12px_24px_rgba(23,106,74,0.35)]"
          />
        </div>
        <div className="mt-3 rounded-2xl border border-amber-300/65 bg-[linear-gradient(135deg,rgba(255,248,235,0.95),rgba(255,238,214,0.92))] p-3.5 shadow-[0_12px_28px_rgba(185,120,32,0.16)] dark:border-amber-300/25 dark:bg-[linear-gradient(135deg,rgba(25,35,44,0.95),rgba(18,28,36,0.92))] dark:shadow-[0_12px_28px_rgba(0,0,0,0.45)]">
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-amber-400/55 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800 dark:border-amber-300/35 dark:bg-white/10 dark:text-amber-200">
            <AlertTriangle size={12} />
            Important Delivery Note
          </div>
          <p className="text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/90">
            Delivered bare-rooted <strong className="text-amber-950 dark:text-amber-100">Without Pot</strong> for safer transit and fresher, healthier plants.
          </p>
        </div>
      </div>

      <div ref={ctaRef} className="mb-5 grid grid-cols-[auto,1fr,auto] items-center gap-3">
        <QuantitySelector value={qty} onChange={setQty} />
        <button
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition ${
            isOutOfStock
              ? "cursor-not-allowed bg-slate-200 text-slate-600"
              : "bg-[linear-gradient(135deg,#0a8f6a_0%,#12b981_55%,#0a8f6a_100%)] text-white shadow-[0_16px_34px_rgba(10,143,106,0.32)] hover:shadow-[0_20px_40px_rgba(10,143,106,0.4)]"
          }`}
          disabled={isOutOfStock}
          onClick={() => {
            if (isOutOfStock) return;
            addToCart(
              {
                id: product.id,
                title: product.title,
                price: product.price,
                image: product.image,
                imageAlt: resolveProductImageAlt(product.imageAlt),
                handle: product.handle,
                tags: productTags,
              },
              qty
            );
            showSuccessToast(`${product.title} added to cart`);
          }}
        >
          {!isOutOfStock ? <ShoppingBag size={17} strokeWidth={2} aria-hidden="true" /> : null}
          {isOutOfStock ? "Sold Out" : "Add to Cart"}
        </button>
        <WishlistButton product={wishlistProduct} />
      </div>

      {showStickyCta && hasScrolled && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 md:hidden">
          <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f7f4ed_45%,#eef6f1_100%)] p-3 shadow-[0_28px_70px_rgba(7,20,14,0.45)] ring-1 ring-emerald-200/40 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140px_90px_at_12%_0%,rgba(10,143,106,0.22),transparent_60%),radial-gradient(180px_120px_at_100%_0%,rgba(247,231,205,0.55),transparent_60%)]" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-emerald-200/35 blur-2xl" />
            <div className="pointer-events-none absolute -left-12 bottom-6 h-20 w-20 rounded-full bg-[#f6d7b5]/40 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/70 shadow-[0_10px_22px_rgba(25,36,30,0.28)]">
                <Image
                  src={wishlistProduct.image}
                  alt={wishlistProduct.imageAlt || wishlistProduct.title}
                  fill
                  sizes="56px"
                  className="object-cover"
                  unoptimized={shouldBypassImageOptimization(wishlistProduct.image)}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[13px] font-semibold text-[var(--color-text)]"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {wishlistProduct.title}
                </p>
                <PriceWithDiscount
                  price={product.price}
                  compareAtPrice={compareAtPrice}
                  currency={currency}
                  size="sm"
                  badgePlacement="inline"
                  badgeVariant="off"
                  allowWrap={false}
                  priceClassName="text-[var(--color-text)]"
                  badgeClassName="uppercase tracking-[0.08em] !border-emerald-200/70 !bg-[linear-gradient(135deg,#176a4a,#2fbf7a)] shadow-[0_10px_22px_rgba(23,106,74,0.32)]"
                />
              </div>
            </div>
            <button
              className={`relative mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] ${
                isOutOfStock
                  ? "cursor-not-allowed bg-slate-200 text-slate-600"
                  : "bg-[linear-gradient(135deg,#0a8f6a_0%,#12b981_55%,#0a8f6a_100%)] text-white shadow-[0_16px_34px_rgba(10,143,106,0.48)]"
              }`}
              disabled={isOutOfStock}
              onClick={() => {
                if (isOutOfStock) return;
                addToCart(
                  {
                    id: product.id,
                    title: product.title,
                    price: product.price,
                    image: product.image,
                    imageAlt: resolveProductImageAlt(product.imageAlt),
                    handle: product.handle,
                    tags: productTags,
                  },
                  qty
                );
                showSuccessToast(`${product.title} added to cart`);
              }}
              aria-label={isOutOfStock ? "Sold out" : "Add to cart"}
            >
              {!isOutOfStock ? <ShoppingBag size={15} strokeWidth={2} aria-hidden="true" /> : null}
              {isOutOfStock ? "Sold Out" : "Add to Cart"}
            </button>
          </div>
        </div>
      )}

      {tabsSlot && (
        <div className="mb-5 border-t border-gray-100 pt-5 md:dark:border-[color:rgba(143,191,148,0.18)]">
          <PincodeServiceabilityCard className="mb-4" />
          {tabsSlot}
        </div>
      )}

      <div className="mb-3">
        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <SunMedium size={18} />
            <span>{careSignals.light}</span>
          </div>
          <div className="flex items-center gap-2">
            <Droplets size={18} />
            <span>{careSignals.water}</span>
          </div>
        </div>
      </div>

      <p className="mb-3 text-sm text-[var(--auth-muted)]">Each plant is carefully selected and packed with love.</p>

      <aside className="mt-6 mb-6 overflow-hidden rounded-xl border border-[#d9ccb9] bg-[linear-gradient(145deg,#fff8ec_0%,#f2ecdf_62%,#eef5eb_100%)] shadow-[0_14px_30px_-24px_rgba(52,68,56,0.75)] md:hidden dark:border-white/10 dark:bg-[linear-gradient(145deg,#0c1721_0%,#0a141d_62%,#0b1722_100%)] dark:shadow-[0_14px_30px_-24px_rgba(0,0,0,0.6)]">
        <div className="bg-[linear-gradient(90deg,#1d4534_0%,#667f54_50%,#b88962_100%)] px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-white">
          PURCHASE NOTE
        </div>
        <div className="space-y-1.5 p-3 text-xs leading-relaxed text-[#3b4e43] dark:text-[var(--auth-muted)]">
          <p className="font-medium text-[#26382f] dark:text-[var(--color-text)]">Please review before ordering:</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Unboxing video is mandatory for refund and return eligibility.</li>
            <li>We offer a 7-day return window only for defective, damaged, or incorrect items. As we are shipping live plants, a mandatory unboxing video is required to process your request quickly and fairly.</li>
            <li>Plants are generally delivered bare-root unless stated otherwise.</li>
            <li>Pots shown in product imagery are for catalog representation.</li>
          </ul>
          <p>
            For an easy return or refund experience, connect with us directly on WhatsApp or email us. Our team handles defective-item claims personally so we can resolve them quickly.
          </p>
          <a
            href="https://wa.me/919458321209?text=Hi%20Succulent%20Sphere,%20I%20need%20help%20regarding%20return%20or%20refund."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-lg border border-[#ccbba4] bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-[#304338] transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-[var(--color-text)] dark:hover:bg-white/15"
          >
            WhatsApp Return &amp; Refund Support
          </a>
          <Link href="/refund-policy" className="inline-flex rounded-lg border border-[#ccbba4] bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-[#304338] transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-[var(--color-text)] dark:hover:bg-white/15">
            View Refund &amp; Cancellation Policy
          </Link>
        </div>
      </aside>

      {product?.id && product?.handle ? (
        <ProductReviewsSection
          productId={String(product.id)}
          productHandle={String(product.handle)}
          initialReviews={Array.isArray(product?.reviews) ? product.reviews : []}
          initialReviewCount={reviewCount}
          initialRating={ratingValue}
        />
      ) : null}
    </div>
  );
}
