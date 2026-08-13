"use client";
import Image from "next/image";
import Link from "next/link";
import QuantitySelector from "../product/QuantitySelector";
import { useCallback } from "react";
import { formatINR } from "@/lib/currency";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";

type CartItemShape = {
  id: string;
  title: string;
  handle: string;
  price: string;
  image: string;
  imageAlt?: string;
  quantity: number;
  isBundleHeader?: boolean;
  bundleTitle?: string;
  bundleDiscountRate?: number;
};

export default function CartItem({
  item,
  onChangeQty,
  onRemove,
  disableQty = false,
  hideRemove = false
}: {
  item: CartItemShape;
  onChangeQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  disableQty?: boolean;
  hideRemove?: boolean;
}) {
  const handleQty = useCallback((n: number) => onChangeQty(item.id, n), [item.id, onChangeQty]);
  const hasLink = Boolean(item.handle);
  const discountRate = Number(item.bundleDiscountRate || 0);
  const hasDiscount = discountRate > 0 && discountRate < 0.95 && !item.isBundleHeader;
  const originalUnitPrice = hasDiscount ? Number(item.price) / (1 - discountRate) : Number(item.price);
  const imageSrc = normalizeImageUrl(item.image);

  return (
    <div className={`bg-white rounded-lg p-3 sm:p-4 shadow-sm flex gap-3 sm:gap-4 items-start ${item.isBundleHeader ? "border border-emerald-200/70 bg-emerald-50/40" : ""}`}>
      <div className="w-20 h-20 sm:w-24 sm:h-24 relative flex-shrink-0">
        {hasLink ? (
          <Link href={`/collections/succulents/${item.handle}`}>
            <Image src={imageSrc} alt={item.imageAlt || item.title} fill style={{ objectFit: "cover" }} className="rounded" unoptimized={shouldBypassImageOptimization(imageSrc)} />
          </Link>
        ) : (
          <Image src={imageSrc} alt={item.imageAlt || item.title} fill style={{ objectFit: "cover" }} className="rounded" unoptimized={shouldBypassImageOptimization(imageSrc)} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          {hasLink ? (
            <Link href={`/collections/succulents/${item.handle}`} className="text-sm font-semibold text-[var(--color-text)] block truncate">
              {item.title}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-[var(--color-text)] block truncate">{item.title}</span>
          )}
          <div className="text-sm font-medium whitespace-nowrap">{formatINR(Number(item.price) * item.quantity)}</div>
        </div>
        <div className="text-sm text-gray-700 mt-2">
          {hasDiscount ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 line-through">{formatINR(originalUnitPrice)}</span>
              <span className="text-sm text-gray-700">{formatINR(item.price)}</span>
            </div>
          ) : (
            formatINR(item.price)
          )}
        </div>
        <div className="mt-3 grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            {disableQty ? (
              <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">{item.isBundleHeader ? "Combo Bundle" : "Combo item"}</div>
            ) : (
              <QuantitySelector value={item.quantity} onChange={handleQty} compact />
            )}
          </div>
          {hideRemove ? null : (
            <button
              aria-label={`Remove ${item.title}`}
              onClick={() => onRemove(item.id)}
              className="z-10 justify-self-end whitespace-nowrap text-sm text-red-600 px-1 py-1"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
