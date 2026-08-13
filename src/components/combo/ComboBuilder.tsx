"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import { formatINR } from "@/lib/currency";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type ComboProduct = {
  id: string;
  title: string;
  handle: string;
  price: string;
  image: string;
  imageAlt?: string;
  tags?: string[];
};

type Props = {
  products: ComboProduct[];
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ComboBuilder({ products }: Props) {
  const { addToCart } = useCart();
  const [selected, setSelected] = useState<ComboProduct[]>([]);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const shakeTimerRef = useRef<number | null>(null);
  const successTimerRef = useRef<number | null>(null);

  const selectedIds = useMemo(() => new Set(selected.map((item) => item.id)), [selected]);
  const selectedCount = selected.length;
  const originalTotal = selected.reduce((sum, item) => sum + toNumber(item.price), 0);
  const discountRate = 0.1;
  const discountedTotal = originalTotal * (1 - discountRate);

  const toggleSelect = (product: ComboProduct) => {
    if (selectedIds.has(product.id)) {
      setSelected((prev) => prev.filter((item) => item.id !== product.id));
      return;
    }

    if (selected.length >= 4) {
      setShakeId(product.id);
      showErrorToast("Max 4 plants - remove one to swap");
      if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = window.setTimeout(() => setShakeId(null), 450);
      return;
    }

    setSelected((prev) => [...prev, product]);
  };

  const removeSelected = (id: string) => {
    setSelected((prev) => prev.filter((item) => item.id !== id));
  };

  const addComboToCart = () => {
    if (selected.length !== 4) return;
    const handles = selected.map((item) => item.handle).filter(Boolean).sort();
    const comboTitle = "Custom Combo (4 plants)";
    const comboImage = selected[0]?.image || "/assets/product-1.jpg";
    const comboImageAlt = selected[0]?.imageAlt || comboTitle;
    const bundleId = `combo-${handles.join("-") || "selection"}-${Date.now()}`;
    addToCart(
      {
        id: `bundle-${bundleId}`,
        title: comboTitle,
        price: "0.00",
        image: comboImage,
        imageAlt: comboImageAlt,
        handle: "",
        itemCategory: "Combo",
        tags: Array.isArray(selected[0]?.tags) ? selected[0]!.tags : [],
        bundleId,
        bundleTitle: comboTitle,
        bundleDiscountRate: discountRate,
        isBundleHeader: true,
      },
      1
    );

    selected.forEach((item) => {
      const discountedPrice = (toNumber(item.price) * (1 - discountRate)).toFixed(2);
      addToCart(
        {
          id: `${bundleId}-${item.id}`,
          title: item.title,
          price: discountedPrice,
          image: item.image,
          imageAlt: item.imageAlt,
          handle: item.handle,
          itemCategory: "Combo Item",
          tags: Array.isArray(item.tags) ? item.tags : [],
          bundleId,
          bundleTitle: comboTitle,
          bundleDiscountRate: discountRate,
        },
        1
      );
    });

    setAddedSuccess(true);
    showSuccessToast("🌿 Combo added to cart!");
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    successTimerRef.current = window.setTimeout(() => setAddedSuccess(false), 2400);
  };

  return (
    <section className="pb-28">
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => {
          const isSelected = selectedIds.has(product.id);
          const shouldShake = shakeId === product.id;
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => toggleSelect(product)}
              className={`group relative overflow-hidden rounded-[26px] border bg-[linear-gradient(180deg,#ffffff_0%,#f8f4ec_100%)] text-left shadow-[0_18px_40px_rgba(12,18,14,0.16)] transition-all ${
                isSelected
                  ? "border-emerald-500 ring-2 ring-emerald-300/70"
                  : "border-[#e4ddd2] hover:-translate-y-0.5 hover:shadow-[0_24px_46px_rgba(12,18,14,0.2)]"
              } ${shouldShake ? "combo-shake" : ""}`}
              aria-pressed={isSelected}
            >
              <div className="relative aspect-square w-full overflow-hidden bg-[#f3ede3]">
                <Image
                  src={normalizeImageUrl(product.image)}
                  alt={product.imageAlt || product.title}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  unoptimized={shouldBypassImageOptimization(product.image)}
                />
                {isSelected && (
                  <div className="absolute inset-0 flex items-start justify-end bg-emerald-900/20 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 12l5 5L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <h3 className="line-clamp-2 text-sm font-semibold text-[#1f2622]">{product.title}</h3>
                <p className="text-sm font-semibold text-emerald-700">{formatINR(product.price)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedCount > 0 ? (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-[26px] border border-emerald-200/60 bg-[#101613]/95 p-4 text-[#f6f1e6] shadow-[0_28px_60px_rgba(9,14,11,0.35)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="flex -space-x-3">
                {selected.map((item) => (
                  <div key={item.id} className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white/90">
                    <Image src={normalizeImageUrl(item.image)} alt={item.imageAlt || item.title} fill className="object-cover" unoptimized={shouldBypassImageOptimization(item.image)} />
                    <button
                      type="button"
                      onClick={() => removeSelected(item.id)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-emerald-700 shadow"
                      aria-label={`Remove ${item.title}`}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{selectedCount}/4 selected</p>
                <p className="text-xs text-emerald-100/70">Pick {Math.max(0, 4 - selectedCount)} more to unlock the combo</p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 md:items-end">
              <div className="text-xs text-emerald-100/70">Combo Total</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400 line-through">{formatINR(originalTotal)}</span>
                <span className="text-lg font-semibold text-emerald-300">{formatINR(discountedTotal)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={addComboToCart}
                disabled={selectedCount !== 4}
                className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(16,90,54,0.35)] transition hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-[0_20px_38px_rgba(16,90,54,0.45)] disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                Add Combo to Cart
              </button>
              {addedSuccess ? (
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <span className="combo-check-animate inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12l5 5L19 7" />
                    </svg>
                  </span>
                  🌿 Combo added to cart!
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

