"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { getDiscountPercent } from "@/lib/discount";

type SizeVariant = "sm" | "md" | "lg";
type BadgePlacement = "inline" | "below";
type BadgeVariant = "minus" | "off";

type Props = {
  price: string | number;
  compareAtPrice?: string | number | null;
  currency?: string;
  size?: SizeVariant;
  badgePlacement?: BadgePlacement;
  showBadge?: boolean;
  allowWrap?: boolean;
  badgeVariant?: BadgeVariant;
  className?: string;
  priceClassName?: string;
  compareClassName?: string;
  badgeClassName?: string;
};

const SIZE_STYLES: Record<
  SizeVariant,
  { price: string; compare: string; badge: string; gap: string; badgeGap: string }
> = {
  sm: {
    price: "text-sm font-semibold",
    compare: "text-[11px]",
    badge: "text-[9px] px-2 py-0.5",
    gap: "gap-1.5",
    badgeGap: "mt-1",
  },
  md: {
    price: "text-base font-bold",
    compare: "text-xs",
    badge: "text-[10px] px-2.5 py-0.5",
    gap: "gap-2",
    badgeGap: "mt-1.5",
  },
  lg: {
    price: "text-2xl font-semibold",
    compare: "text-sm",
    badge: "text-[11px] px-3 py-1",
    gap: "gap-2.5",
    badgeGap: "mt-2",
  },
};

function joinClass(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export function DiscountBadge({
  value,
  size,
  className = "",
  variant = "minus",
}: {
  value: number;
  size: SizeVariant;
  className?: string;
  variant?: BadgeVariant;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(value) || value <= 0) return;
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReduced) {
      setDisplayValue(value);
      return;
    }

    const duration = 750;
    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * value));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [value]);

  const baseClass =
    "inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-[linear-gradient(135deg,#0f766e,#22c55e)] font-semibold text-white shadow-[0_8px_16px_rgba(15,118,110,0.28)]";

  return (
    <span
      className={joinClass(baseClass, SIZE_STYLES[size].badge, className)}
      aria-label={`Save ${displayValue}%`}
    >
      {variant === "off" ? `${displayValue}% OFF` : `-${displayValue}%`}
    </span>
  );
}

export default function PriceWithDiscount({
  price,
  compareAtPrice = null,
  currency = "INR",
  size = "md",
  badgePlacement = "inline",
  showBadge = true,
  allowWrap = true,
  badgeVariant = "minus",
  className,
  priceClassName,
  compareClassName,
  badgeClassName,
}: Props) {
  const discountPercent = useMemo(
    () => getDiscountPercent(price, compareAtPrice),
    [price, compareAtPrice]
  );
  const hasDiscount = typeof discountPercent === "number" && discountPercent > 0;
  const formattedPrice = formatCurrency(price, currency);
  const formattedCompare = hasDiscount ? formatCurrency(compareAtPrice ?? "", currency) : "";

  return (
    <div className={joinClass("flex flex-col", className)}>
      <div
        className={joinClass(
          "flex items-center",
          allowWrap ? "flex-wrap" : "flex-nowrap",
          SIZE_STYLES[size].gap
        )}
      >
        <span className={joinClass("text-[var(--color-brand)]", SIZE_STYLES[size].price, priceClassName)}>
          {formattedPrice}
        </span>
        {hasDiscount ? (
          <span
            className={joinClass(
              "text-slate-500 line-through dark:text-[var(--auth-muted)]",
              SIZE_STYLES[size].compare,
              compareClassName
            )}
          >
            {formattedCompare}
          </span>
        ) : null}
        {hasDiscount && showBadge && badgePlacement === "inline" ? (
          <DiscountBadge value={discountPercent} size={size} className={badgeClassName} variant={badgeVariant} />
        ) : null}
      </div>
        {hasDiscount && showBadge && badgePlacement === "below" ? (
          <div className={SIZE_STYLES[size].badgeGap}>
          <DiscountBadge value={discountPercent} size={size} className={badgeClassName} variant={badgeVariant} />
          </div>
        ) : null}
    </div>
  );
}
