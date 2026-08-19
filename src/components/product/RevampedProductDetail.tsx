"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "../../context/CartContext";
import { showSuccessToast } from "../../lib/toast";
import DarkModeToggle from "../ui/DarkModeToggle";
import WishlistButton from "../wishlist/WishlistButton";
import { useGtmViewItem } from "@/hooks/useGtmViewItem";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";
import PincodeServiceabilityCard from "@/components/shared/PincodeServiceabilityCard";
import { rememberRecentlyViewedProduct } from "@/lib/recentlyViewed";
import ProductReviewsSection from "@/components/reviews/ProductReviewsSection";
import PriceWithDiscount from "@/components/shared/PriceWithDiscount";

type Props = { product: any };

export default function RevampedProductDetail({ product }: Props) {
  useGtmViewItem({
    id: product?.id,
    title: product?.title,
    price: product?.price,
    category: product?.category || product?.type || product?.productType || "",
    handle: product?.handle,
  });

  const images = useMemo(() => {
    if (Array.isArray(product?.images)) {
      const filtered = product.images
        .map((img: unknown) => {
          if (typeof img === "string") return normalizeImageUrl(img, "");
          if (img && typeof img === "object") {
            const candidate = (img as Record<string, unknown>).url;
            return typeof candidate === "string" ? normalizeImageUrl(candidate, "") : "";
          }
          return "";
        })
        .filter((img: string) => Boolean(img));
      if (filtered.length) return filtered;
    }
    if (typeof product?.image === "string" && product.image) return [normalizeImageUrl(product.image)];
    return ["/assets/product-1.jpg"];
  }, [product?.images, product?.image]);
  const imageAlts = useMemo(() => {
    if (Array.isArray(product?.imageAlts)) {
      const filtered = product.imageAlts.filter((alt: unknown): alt is string => typeof alt === "string" && Boolean(alt));
      if (filtered.length) return filtered;
    }
    return [];
  }, [product?.imageAlts]);
  const [index, setIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [lightbox, setLightbox] = useState(false);
  const [modalScale, setModalScale] = useState(1);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const cart = useCart();
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

  useEffect(() => setIndex(0), [product.handle]);

  useEffect(() => {
    rememberRecentlyViewedProduct({
      id: String(product?.id || product?.handle || ""),
      handle: String(product?.handle || ""),
      title: String(product?.title || ""),
      image: normalizeImageUrl(product?.image || images[0]),
      price: String(product?.price || "0"),
      compareAtPrice: product?.compareAtPrice ?? null,
      currency: String(product?.currency || "INR"),
    });
  }, [
    images,
    product?.currency,
    product?.handle,
    product?.id,
    product?.image,
    product?.price,
    product?.compareAtPrice,
    product?.title,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length]);

  const descriptionHtml = useMemo(() => {
    const raw = typeof product?.descriptionHtml === "string" ? product.descriptionHtml.trim() : "";
    if (!raw) return "";
    // Strip script tags and inline handlers before rendering merchant-managed content.
    return raw
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+="[^"]*"/gi, "")
      .replace(/\son\w+='[^']*'/gi, "");
  }, [product?.descriptionHtml]);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const wishlistProduct = useMemo(
    () => ({
      id: String(product?.id || ""),
      title: String(product?.title || "Untitled"),
      handle: String(product?.handle || ""),
      image: normalizeImageUrl(product?.image || images[0], "/images/succulent-collection.webp"),
      price: String(product?.price || "0.00"),
      compareAtPrice: product?.compareAtPrice ?? null,
      currency: String(product?.currency || "INR"),
      available: !isOutOfStock,
    }),
    [
      images,
      product?.available,
      product?.handle,
      product?.id,
      product?.image,
      product?.price,
      product?.compareAtPrice,
      product?.title,
      product?.currency,
    ]
  );

  useEffect(() => {
    if (lightbox) document.body.style.overflow = "hidden";
    else {
      document.body.style.overflow = "";
      setModalScale(1);
    }
  }, [lightbox]);

  const clamp = (v: number, a = 1, b = 3) => Math.min(b, Math.max(a, v));

  function onWheelZoom(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY / 500;
    setModalScale((s) => clamp(s + delta));
  }

  function onDoubleClickToggle() {
    setModalScale((s) => (s > 1 ? 1 : 2));
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { startDist: Math.hypot(dx, dy), startScale: modalScale };
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchRef.current.startDist;
      setModalScale(clamp(pinchRef.current.startScale * ratio));
    }
  }

  function onTouchEnd() {
    pinchRef.current = null;
  }

  return (
    <div className="fade-in">
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 mt-5">
        <div className="lg:col-span-7">
          <div className="relative bg-white rounded-2xl overflow-hidden shadow-lg hover-scale h-[50vh] sm:h-[75vh] md:h-[90vh] dark:bg-[#0b1722] dark:shadow-[0_18px_40px_rgba(0,0,0,0.55)]" style={{ borderRadius: 18 }}>
            <div className="w-full h-full flex items-center justify-center bg-[var(--color-bg)]">
              <Image
                src={images[index]}
                alt={imageAlts[index] || `${product.title} image ${index + 1}`}
                width={1200}
                height={1200}
                className="h-full max-h-full w-full max-w-full cursor-zoom-in object-contain transition-transform duration-200"
                unoptimized={shouldBypassImageOptimization(images[index])}
                onClick={() => setLightbox(true)}
              />
            </div>

            <button aria-label="prev" onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 p-3 rounded-full shadow-lg hover:scale-105 dark:bg-black/35 dark:shadow-[0_12px_26px_rgba(0,0,0,0.5)]">
              <svg className="w-5 h-5 text-[var(--color-brand)]" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button aria-label="next" onClick={() => setIndex((i) => (i + 1) % images.length)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 p-3 rounded-full shadow-lg hover:scale-105 dark:bg-black/35 dark:shadow-[0_12px_26px_rgba(0,0,0,0.5)]">
              <svg className="w-5 h-5 text-[var(--color-brand)]" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div className="mt-4 flex gap-3">
            {images.map((img, i) => (
              <button key={i} onClick={() => setIndex(i)} className={`relative h-20 w-20 overflow-hidden rounded-lg ${i === index ? 'ring-2 ring-[var(--color-brand)]' : 'border'} `}>
                <Image src={img} alt={imageAlts[i] || `${product.title} thumbnail ${i + 1}`} fill sizes="80px" className="object-cover" unoptimized={shouldBypassImageOptimization(img)} />
              </button>
            ))}
          </div>
        </div>

        <aside className="lg:col-span-5 font-dmsans flex flex-col justify-between mt-2">
          <div>
            <div className="text-sm text-slate-600 mb-2 dark:text-[var(--auth-muted)]">Shop / Succulents / <span className="text-[var(--color-brand)]">{product.title}</span></div>
            <div className="flex items-start gap-4">
              <h1 className="text-4xl text-[var(--color-text)] leading-tight">{product.title}</h1>
              <div className="ml-auto flex items-center gap-2">
                <WishlistButton product={wishlistProduct} />
                <DarkModeToggle />
              </div>
            </div>

            {hasReviews ? (
              <div className="mt-3 mb-4 flex items-center gap-3">
                <div className="flex items-center text-sm text-yellow-500">{Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className={`w-4 h-4 ${i < Math.round(ratingValue) ? "fill-current text-yellow-400" : "text-gray-200"}`} viewBox="0 0 24 24"><path d="M12 .587l3.668 7.431L23.4 9.748l-5.7 5.555L18.9 24 12 19.897 5.1 24l1.2-8.697L.6 9.748l7.732-1.73z"/></svg>
                ))}</div>
                <div className="text-sm text-slate-600 dark:text-[var(--auth-muted)]">{ratingValue.toFixed(1)} • {reviewCount} reviews</div>
              </div>
            ) : null}

            <div className="mb-4">
              <PriceWithDiscount
                price={product?.price}
                compareAtPrice={compareAtPrice}
                currency={currency}
                size="lg"
                badgePlacement="inline"
                badgeVariant="off"
                badgeClassName="uppercase tracking-[0.08em] !border-emerald-200/70 !bg-[linear-gradient(135deg,#176a4a,#2fbf7a)] shadow-[0_12px_24px_rgba(23,106,74,0.35)]"
              />
            </div>

            <PincodeServiceabilityCard className="mb-4" />

            <div className="mb-6">
              {descriptionHtml ? (
                <div
                  className={`prose prose-sm max-w-none text-slate-800 prose-p:my-2 prose-li:my-1 dark:text-[var(--color-text)] ${
                    descriptionExpanded ? "" : "line-clamp-2"
                  }`}
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />
              ) : (
                <p className={`text-sm text-slate-800 dark:text-[var(--color-text)] ${descriptionExpanded ? "" : "line-clamp-2"}`}>
                  {product.description}
                </p>
              )}
              <button
                type="button"
                onClick={() => setDescriptionExpanded((v) => !v)}
                className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-brand)]"
              >
                {descriptionExpanded ? "Read less" : "Read more"}
              </button>
            </div>

            <div className="mb-6" />

            <div className="mb-6 flex items-center gap-3">
              <div className="inline-flex items-center border rounded overflow-hidden">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-3">-</button>
                <div className="px-6 py-3">{qty}</div>
                <button onClick={() => setQty((q) => q + 1)} className="px-4 py-3">+</button>
              </div>

              <button
                onClick={() => {
                  if (isOutOfStock) return;
                  try {
                    cart.addToCart(
                      {
                        id: product.id,
                        title: product.title,
                        price: product.price,
                        image: product.image,
                        imageAlt: product.imageAlt || product.title,
                        handle: product.handle,
                        tags: productTags,
                      },
                      qty
                    );
                    showSuccessToast(`${product.title} added to cart`);
                  } catch {}
                }}
                disabled={isOutOfStock}
                className={`flex-1 px-6 py-3 rounded-md shadow-md flex items-center justify-center gap-3 ${
                  isOutOfStock
                    ? "cursor-not-allowed bg-slate-200 text-slate-600"
                    : "bg-[var(--color-brand)] text-white hover-scale"
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M3 3h18v2H3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {isOutOfStock ? "Sold Out" : "Add to Cart"}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="grid grid-cols-3 gap-6 text-center text-sm text-slate-600 dark:text-[var(--auth-muted)]">
              <div>
                <div className="mx-auto w-10 h-10 rounded-full bg-white border flex items-center justify-center mb-2 dark:bg-white/10 dark:border-white/15" style={{ color: "var(--color-brand)" }}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7h11v8H3z" />
                    <path d="M14 10h4l3 3v2h-7" />
                    <circle cx="7" cy="17" r="1.5" />
                    <circle cx="18" cy="17" r="1.5" />
                  </svg>
                </div>
                <div className="font-semibold">Safe Shipping</div>
                <div className="text-xs">Packed with care</div>
              </div>

              <div>
                <div className="mx-auto w-10 h-10 rounded-full bg-white border flex items-center justify-center mb-2 dark:bg-white/10 dark:border-white/15" style={{ color: "var(--color-secondary)" }}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2l7 4v6c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-4z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <div className="font-semibold">Healthy Guarantee</div>
                <div className="text-xs">7-day defective-item returns</div>
              </div>

              <div>
                <div className="mx-auto w-10 h-10 rounded-full bg-white border flex items-center justify-center mb-2 dark:bg-white/10 dark:border-white/15" style={{ color: "var(--color-accent)" }}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 5h8l4 4v9H4z" />
                    <path d="M12 5v4h4" />
                    <path d="M8 14h8" />
                    <path d="M8 17h5" />
                  </svg>
                </div>
                <div className="font-semibold">24/7 Support</div>
                <div className="text-xs">Live chat</div>
              </div>
            </div>
          </div>
        </aside>
      </main>

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
            <li>Ships bare-rooted across India in 5-7 days for safer transit and fresher arrival.</li>
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

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" role="dialog" aria-modal="true" aria-label="Image preview" onClick={() => setLightbox(false)}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-center">
              <div className="overflow-hidden bg-black rounded-md" style={{ maxHeight: '90vh' }}>
                <Image
                  src={images[index]}
                  alt={imageAlts[index] || `${product.title} image ${index + 1}`}
                  width={1600}
                  height={1600}
                  unoptimized={shouldBypassImageOptimization(images[index])}
                  onWheel={onWheelZoom}
                  onDoubleClick={onDoubleClickToggle}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  style={{ transform: `scale(${modalScale})`, transition: 'transform 180ms ease' }}
                  className="block max-h-[90vh] w-auto object-contain touch-none cursor-zoom-in"
                />
              </div>

              <button onClick={(e) => { e.stopPropagation(); setLightbox(false); }} className="absolute top-4 right-4 p-2 bg-white rounded dark:bg-black/40 dark:text-white">âœ•</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





