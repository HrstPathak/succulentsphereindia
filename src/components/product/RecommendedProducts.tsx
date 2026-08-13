"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCart } from "../../context/CartContext";
import { showSuccessToast } from "../../lib/toast";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";
import PriceWithDiscount from "@/components/shared/PriceWithDiscount";

type ProductItem = {
  id: string;
  title: string;
  handle: string;
  price: string;
  compareAtPrice?: string | null;
  currency: string;
  image: string;
  imageAlt?: string;
  reason?: string;
  score?: number;
  available?: boolean | string;
};

type Props = {
  currentId?: string;
  currentHandle?: string;
  currentProduct?: Partial<ProductItem> & { handle?: string };
  collectionHandle?: string;
  limit?: number;
};

function isAvailable(input: ProductItem): boolean {
  if (typeof input.available === "boolean") return input.available;
  if (typeof input.available === "string") return input.available !== "OutOfStock";
  return true;
}

export default function RecommendedProducts({
  currentId,
  currentHandle,
  currentProduct,
  collectionHandle = "succulents",
  limit = 4,
}: Props) {
  const { addToCart } = useCart();
  const maxItems = Math.max(1, Math.min(limit, 4));
  const handle = currentHandle || currentProduct?.handle || "";
  const [recs, setRecs] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!handle) {
      setLoading(false);
      setReady(true);
      setRecs([]);
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setLoadedImages({});
      try {
        const response = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            handle,
            limit: maxItems,
          }),
        });

        if (!response.ok) throw new Error("Recommendation request failed");
        const data = await response.json();
        const ranked = Array.isArray(data?.recommendations) ? data.recommendations : [];
        if (ranked.length > 0) {
          setRecs(ranked.slice(0, maxItems));
        } else {
          setRecs([]);
        }
      } catch {
        setRecs([]);
      } finally {
        setLoading(false);
        setReady(true);
      }
    };

    run();
    return () => controller.abort();
  }, [handle, maxItems]);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#e8ddd0] bg-[var(--color-bg)] p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(163,177,138,0.28),transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-16 -left-14 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(203,153,126,0.2),transparent_70%)]" />

      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#7c8576]">Curated for you</p>
          <h3 className="font-serif text-2xl text-[var(--color-brand)]">Recommended Products</h3>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: maxItems }).map((_, index) => (
            <div key={`skeleton-${index}`} className="animate-pulse rounded-2xl border border-[#e6ddcf] bg-white/80 p-3 shadow-[0_8px_20px_rgba(52,78,65,0.08)]">
              <div className="aspect-square rounded-xl bg-[#ebe5da]" />
              <div className="mt-3 h-4 rounded bg-[#ebe5da]" />
              <div className="mt-2 h-3 w-2/3 rounded bg-[#f0eadd]" />
              <div className="mt-3 h-9 rounded-xl bg-[#ebe5da]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {recs.map((product, index) => {
            const imageSrc = normalizeImageUrl(product.image);
            return (
              <motion.article
                key={product.id}
                className="group overflow-hidden rounded-2xl border border-[#e6ddcf] bg-white shadow-[0_12px_28px_rgba(52,78,65,0.12)] transition-shadow hover:shadow-[0_16px_34px_rgba(52,78,65,0.2)]"
                initial={{ opacity: 0, y: 14 }}
                animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
                whileHover={{ y: -4 }}
              >
                <Link href={`/collections/${collectionHandle}/${product.handle}`} className="block">
                  <div className="relative aspect-square bg-[#f2ede5]">
                    {!loadedImages[product.id] ? (
                      <div className="absolute inset-0 animate-pulse rounded-none bg-[#e9e2d6]" />
                    ) : null}
                    <Image
                      src={imageSrc}
                      alt={product.imageAlt || product.title}
                      fill
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      className={`object-cover transition-transform duration-500 group-hover:scale-105 ${
                        loadedImages[product.id] ? "opacity-100" : "opacity-0"
                      }`}
                      loading="lazy"
                      unoptimized={shouldBypassImageOptimization(imageSrc)}
                      onLoad={() =>
                        setLoadedImages((prev) => ({
                          ...prev,
                          [product.id]: true,
                        }))
                      }
                    />
                  </div>
                </Link>
                <div className="p-3">
                  <h4 className="line-clamp-2 text-sm font-semibold text-[var(--color-text)]">{product.title}</h4>
                  <div className="mt-1">
                    <PriceWithDiscount
                      price={product.price}
                      compareAtPrice={product.compareAtPrice ?? null}
                      currency={product.currency || "INR"}
                      size="sm"
                      badgePlacement="inline"
                      showBadge={false}
                    />
                  </div>
                  {product.reason ? <p className="mt-1 line-clamp-2 text-xs text-[#6f7567]">{product.reason}</p> : null}
                  <button
                    type="button"
                    disabled={!isAvailable(product)}
                    className="mt-3 w-full rounded-xl bg-[var(--color-brand)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#2b4136] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      if (!isAvailable(product)) return;
                      addToCart(
                        {
                          id: product.id,
                          title: product.title,
                          price: product.price,
                          image: imageSrc,
                          imageAlt: product.imageAlt || product.title,
                          handle: product.handle,
                          tags: Array.isArray((product as { tags?: string[] }).tags)
                            ? (product as { tags?: string[] }).tags
                            : [],
                        },
                        1
                      );
                      showSuccessToast(`${product.title} added to cart`);
                    }}
                  >
                    {isAvailable(product) ? "Add to Cart" : "Sold Out"}
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
      {!loading && recs.length === 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: maxItems }).map((_, index) => (
            <div key={`empty-skeleton-${index}`} className="animate-pulse rounded-2xl border border-[#e6ddcf] bg-white/80 p-3 shadow-[0_8px_20px_rgba(52,78,65,0.08)]">
              <div className="aspect-square rounded-xl bg-[#ebe5da]" />
              <div className="mt-3 h-4 rounded bg-[#ebe5da]" />
              <div className="mt-2 h-3 w-2/3 rounded bg-[#f0eadd]" />
              <div className="mt-3 h-9 rounded-xl bg-[#ebe5da]" />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
