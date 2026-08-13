"use client";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CartItem from "./CartItem";
import CartSummary from "./CartSummary";
import { useCart } from "../../context/CartContext";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";
import { formatINR } from "@/lib/currency";
import {
  DISCOUNT_THRESHOLD,
  FREE_DELIVERY_THRESHOLD,
  FREE_SHIPPING_TAGS,
  MIN_ORDER_AMOUNT,
} from "@/lib/pricing";

type Milestone = {
  amount: number;
  label: string;
  type: "order" | "free" | "discount";
};

const MILESTONES: Milestone[] = [
  { amount: MIN_ORDER_AMOUNT, label: "Minimum Order", type: "order" },
  { amount: FREE_DELIVERY_THRESHOLD, label: "Free Delivery", type: "free" },
  { amount: DISCOUNT_THRESHOLD, label: "+5% Discount", type: "discount" },
];
const TRACK_SIDE_PADDING = 10;

export default function CartClient() {
  const { items, updateQty, removeFromCart } = useCart();
  const [showBurst, setShowBurst] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [expandedBundles, setExpandedBundles] = useState<Record<string, boolean>>({});
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0), [items]);
  const unlockedCount = useMemo(() => MILESTONES.filter((m) => subtotal >= m.amount).length, [subtotal]);
  const prevUnlockedCount = useRef(unlockedCount);
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freeDeliveryMilestone = useMemo(() => MILESTONES.find((m) => m.type === "free"), []);
  const discountMilestone = useMemo(() => MILESTONES.find((m) => m.type === "discount"), []);
  const comboFreeShippingEligible = useMemo(() => {
    const eligible = new Set(
      FREE_SHIPPING_TAGS.map((tag) => String(tag || "").trim().toLowerCase()).filter(Boolean)
    );
    if (eligible.size === 0) return false;
    return items.some((item) =>
      Array.isArray(item.tags)
        ? item.tags.some((tag) => eligible.has(String(tag || "").trim().toLowerCase()))
        : false
    );
  }, [items]);

  const milestonePoints = useMemo(() => {
    const count = MILESTONES.length;
    if (count === 0) return [];
    const start = TRACK_SIDE_PADDING;
    const end = 100 - TRACK_SIDE_PADDING;
    const span = Math.max(0, end - start);
    return MILESTONES.map((milestone, index) => ({
      ...milestone,
      pointPct: count === 1 ? 50 : start + (span * index) / (count - 1),
    }));
  }, []);
  const progressPct = useMemo(() => {
    if (milestonePoints.length === 0) return 0;
    const first = milestonePoints[0];
    if (subtotal <= first.amount) {
      if (first.amount <= 0) return first.pointPct;
      return Math.min(first.pointPct, (subtotal / first.amount) * first.pointPct);
    }
    for (let i = 1; i < milestonePoints.length; i += 1) {
      const prev = milestonePoints[i - 1];
      const current = milestonePoints[i];
      if (subtotal <= current.amount) {
        const spanAmount = current.amount - prev.amount;
        if (spanAmount <= 0) return current.pointPct;
        const t = (subtotal - prev.amount) / spanAmount;
        return prev.pointPct + t * (current.pointPct - prev.pointPct);
      }
    }
    return milestonePoints[milestonePoints.length - 1].pointPct;
  }, [subtotal, milestonePoints]);
  const nextMilestone = MILESTONES.find((m) => subtotal < m.amount);
  const allUnlocked = !nextMilestone;
  const canCheckout = subtotal >= MIN_ORDER_AMOUNT;

  const changeQty = useCallback((id: string, qty: number) => {
    updateQty(id, qty);
  }, [updateQty]);

  const remove = useCallback((id: string, bundleId?: string) => {
    if (!bundleId) {
      removeFromCart(id);
      return;
    }
    const bundleItems = items.filter((item) => item.bundleId === bundleId);
    bundleItems.forEach((item) => removeFromCart(item.id));
  }, [items, removeFromCart]);

  const toggleBundle = useCallback((bundleId: string) => {
    setExpandedBundles((prev) => ({ ...prev, [bundleId]: !prev[bundleId] }));
  }, []);

  const applyCoupon = useCallback((code: string) => {
    // placeholder - integrate with Storefront API
    alert(`Apply coupon: ${code}`);
  }, []);

  const milestoneMessage = !canCheckout
    ? `Minimum order is ${formatINR(MIN_ORDER_AMOUNT, 0)}. Add ${formatINR(MIN_ORDER_AMOUNT - subtotal, 0)} more to continue to checkout.`
    : comboFreeShippingEligible
      ? "Free Delivery Unlocked for Combo."
      : allUnlocked
        ? "Premium rewards unlocked. You now qualify for the additional 5% discount."
        : `Add ${formatINR(nextMilestone.amount - subtotal, 0)} more to unlock ${nextMilestone.label}.`;

  useEffect(() => {
    if (unlockedCount > prevUnlockedCount.current) {
      if (burstTimeoutRef.current) {
        clearTimeout(burstTimeoutRef.current);
      }
      setBurstKey((k) => k + 1);
      setShowBurst(true);
      burstTimeoutRef.current = setTimeout(() => {
        setShowBurst(false);
        burstTimeoutRef.current = null;
      }, 3600);
      prevUnlockedCount.current = unlockedCount;
      return;
    }
    prevUnlockedCount.current = unlockedCount;
  }, [unlockedCount]);

  useEffect(() => {
    return () => {
      if (burstTimeoutRef.current) {
        clearTimeout(burstTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Image src="/images/empty-cart.svg" alt="Empty cart" width={160} height={160} className="mb-6 h-40 w-40 object-contain" />
          <div className="text-lg font-semibold mb-2">Your cart is empty</div>
          <div className="text-sm text-muted mb-4">Add some beautiful succulents to get started.</div>
          <Link href="/collections" className="bg-[var(--color-brand)] text-white px-5 py-2 rounded">Browse Collections</Link>
        </div>
      ) : (
        <>
          <section className="mb-5 rounded-2xl border border-[#eadfcf] bg-[linear-gradient(145deg,#fff5e6_0%,#f3efe6_50%,#e9f4ea_100%)] p-4 shadow-[0_24px_36px_-28px_rgba(39,58,42,0.7)]">
            {showBurst && (
              <div key={burstKey} className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0)_55%)]" />

                {Array.from({ length: 148 }).map((_, i) => {
                  const left = (i * 11) % 100;
                  const delay = (i % 20) * 0.08 + 0.06;
                  const duration = 3.4 + (i % 10) * 0.28;
                  const wobble = (i % 2 === 0 ? 1 : -1) * (24 + (i % 8) * 5);
                  const colorPalette = ["#ff3366", "#ffc300", "#00d4ff", "#67e84f", "#9d4edd", "#ff8a00", "#ff5e5b"];
                  const color = colorPalette[i % colorPalette.length];
                  return (
                    <span
                      key={`rain-${i}`}
                      className="absolute -top-8 opacity-0"
                      style={{
                        left: `${left}%`,
                        width: `${2 + (i % 3)}px`,
                        height: `${9 + (i % 4) * 2}px`,
                        borderRadius: i % 3 === 0 ? "999px" : "2px",
                        backgroundColor: color,
                        boxShadow: `0 0 12px ${color}`,
                        animation: `milestone-rain ${duration}s ease-in ${delay}s forwards`,
                        "--final-transform": `translate(${wobble}px, ${135 + (i % 9) * 7}vh) rotate(${300 + i * 18}deg)`
                      } as CSSProperties}
                    />
                  );
                })}

                {Array.from({ length: 24 }).map((_, i) => {
                  const left = 20 + (i * 57) % 60;
                  const top = 16 + (i * 31) % 38;
                  const delay = (i % 8) * 0.12;
                  const colorPalette = ["#fff176", "#ffffff", "#b3e5fc", "#ffe0b2"];
                  const color = colorPalette[i % colorPalette.length];
                  return (
                    <span
                      key={`spark-${i}`}
                      className="absolute opacity-0"
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: "8px",
                        height: "8px",
                        borderRadius: "999px",
                        backgroundColor: color,
                        boxShadow: `0 0 14px ${color}`,
                        animation: `milestone-spark 1.6s ease-out ${delay}s forwards`
                      } as CSSProperties}
                    />
                  );
                })}
              </div>
            )}

            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#2d3d31]">Cart Rewards Progress</p>
              <p className="text-sm font-medium text-[#405246]">{formatINR(subtotal)}</p>
            </div>

            <div className="relative pt-10">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#d8d8cb]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#ff7b00_0%,#ff006e_36%,#3a86ff_73%,#00c853_100%)] shadow-[0_8px_18px_-12px_rgba(45,68,53,0.95)] transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="pointer-events-none absolute inset-x-0 top-4 h-0.5">
                {milestonePoints.map((milestone) => {
                  const pointPct = milestone.pointPct;
                  const unlocked = subtotal >= milestone.amount;
                  return (
                    <div
                      key={`point-${milestone.amount}`}
                      className="absolute -translate-x-1/2"
                      style={{ left: `${pointPct}%` }}
                    >
                      <div className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full border ${unlocked ? "border-[#ffe5b8] bg-[#fff1d5]" : "border-[#d4d7cc] bg-[#efefe7]"} shadow-sm`}>
                        <MilestonePointIcon type={milestone.type} active={unlocked} />
                      </div>
                      <div className={`h-3 w-0.5 mx-auto ${unlocked ? "bg-[#f08a24]" : "bg-[#b8beb3]"}`} />
                    </div>
                  );
                })}
              </div>

              <div
                className="absolute -top-1 z-10 -translate-x-1/2 transition-all duration-500"
                style={{ left: `${progressPct}%` }}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="rounded-full border border-[#ffd6c7] bg-[#fff8e8] px-2.5 py-1 text-[11px] font-semibold text-[#7e3528] shadow-[0_10px_18px_-16px_rgba(35,54,41,0.95)]">
                    {formatINR(subtotal, 0)}
                  </div>
                  <div className="rounded-full border border-[#ffd8ac] bg-[#fff3dd] p-2 shadow-[0_12px_20px_-15px_rgba(35,54,41,0.9)]">
                    <TruckIcon />
                  </div>
                </div>
              </div>

              <div className="relative mt-3 h-9">
                {milestonePoints.map((milestone) => {
                  const unlocked = subtotal >= milestone.amount;
                  return (
                    <div
                      key={milestone.amount}
                      className="absolute -translate-x-1/2 text-center"
                      style={{ left: `${milestone.pointPct}%` }}
                    >
                      <p className={`text-xs font-semibold ${unlocked ? "text-[#2c4736]" : "text-[#65766c]"}`}>{formatINR(milestone.amount, 0)}</p>
                      <p className={`text-[11px] ${unlocked ? "text-[#446351]" : "text-[#7f8b84]"}`}>{milestone.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-3 text-sm text-[#4d5f54]">{milestoneMessage}</p>
          </section>

          <div className="flex flex-col gap-4">
            {(() => {
              const bundleOrder: string[] = [];
              const bundles = new Map<string, { header?: typeof items[number]; entries: typeof items[number][] }>();
              const standalone: typeof items = [];

              items.forEach((item) => {
                if (!item.bundleId) {
                  standalone.push(item);
                  return;
                }
                if (!bundles.has(item.bundleId)) {
                  bundles.set(item.bundleId, { header: undefined, entries: [] });
                  bundleOrder.push(item.bundleId);
                }
                const group = bundles.get(item.bundleId)!;
                if (item.isBundleHeader) {
                  group.header = item;
                } else {
                  group.entries.push(item);
                }
              });

              return (
                <>
                  {bundleOrder.map((bundleId) => {
                    const group = bundles.get(bundleId);
                    if (!group) return null;
                    const isOpen = expandedBundles[bundleId] ?? false;
                    const discountRate =
                      (group.header as { bundleDiscountRate?: number } | undefined)?.bundleDiscountRate ??
                      (group.entries[0] as { bundleDiscountRate?: number } | undefined)?.bundleDiscountRate ??
                      0;
                    const discountedTotal = group.entries.reduce(
                      (sum, entry) => sum + Number(entry.price) * entry.quantity,
                      0
                    );
                    const originalTotal =
                      discountRate > 0 ? discountedTotal / (1 - discountRate) : discountedTotal;
                    const collageImages = group.entries.slice(0, 4).map((entry) => ({
                      src: entry.image,
                      alt: entry.imageAlt || entry.title,
                    }));
                    return (
                      <div
                        key={bundleId}
                        className="overflow-hidden rounded-lg border border-emerald-200/70 bg-emerald-50/40 shadow-sm"
                      >
                        {group.header ? (
                          <div className="p-3 sm:p-4">
                            <div className="flex gap-3 sm:gap-4 items-start">
                              <div className="w-20 h-20 sm:w-24 sm:h-24 relative flex-shrink-0">
                                <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1">
                                  {collageImages.map((img, idx) => (
                                    <div key={`${bundleId}-img-${idx}`} className="relative overflow-hidden rounded">
                                      <Image src={normalizeImageUrl(img.src)} alt={img.alt} fill style={{ objectFit: "cover" }} unoptimized={shouldBypassImageOptimization(img.src)} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-semibold text-[var(--color-text)]">
                                      {group.header.title}
                                    </div>
                                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-emerald-700">
                                      Combo Bundle
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs text-slate-500 line-through">
                                      {formatINR(originalTotal)}
                                    </div>
                                    <div className="text-sm font-semibold text-emerald-700">
                                      {formatINR(discountedTotal)}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleBundle(bundleId)}
                                    className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800"
                                  >
                                    {isOpen ? "Hide products" : "View all products"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => remove(group.header!.id, bundleId)}
                                    className="text-xs font-semibold text-red-600"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <div
                          className={`transition-all duration-300 ${isOpen ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0"} overflow-hidden`}
                        >
                          <div className="border-t border-emerald-200/60 bg-white/80 p-3 sm:p-4 space-y-3">
                            {group.entries.map((entry) => (
                              <CartItem
                                key={entry.id}
                                item={entry}
                                onChangeQty={changeQty}
                                onRemove={(id) => remove(id, bundleId)}
                                disableQty
                                hideRemove
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {standalone.map((it) => (
                    <CartItem key={it.id} item={it} onChangeQty={changeQty} onRemove={(id) => remove(id)} />
                  ))}
                </>
              );
            })()}
          </div>

          <div className="mt-6">
            <CartSummary
              items={items.map((i) => ({
                id: i.id,
                title: i.title,
                itemCategory: i.itemCategory || "",
                price: i.price,
                quantity: i.quantity,
                tags: i.tags || [],
              }))}
              onApplyCoupon={applyCoupon}
              canCheckout={canCheckout}
              minOrderAmount={MIN_ORDER_AMOUNT}
            />
          </div>
        </>
      )}
      <style jsx>{`
        @keyframes milestone-rain {
          0% {
            opacity: 0;
            transform: translate(0, 0) rotate(0deg) scale(0.8);
          }
          18% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: var(--final-transform, translate(0, 125vh) rotate(360deg)) scale(1);
          }
        }

        @keyframes milestone-spark {
          0% {
            opacity: 0;
            transform: scale(0.2);
          }
          30% {
            opacity: 1;
            transform: scale(1.2);
          }
          100% {
            opacity: 0;
            transform: scale(0.8);
          }
        }
      `}</style>
    </div>
  );
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-[#e2721a]">
      <path d="M2 6h12v8H2V6Zm12 2h3l3 3v3h-6V8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="7" cy="16.5" r="1.7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="16.5" r="1.7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MilestonePointIcon({ type, active }: { type: "order" | "free" | "discount"; active: boolean }) {
  const color = active ? "#e2721a" : "#8d968b";
  if (type === "order") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M8 7h8M6 9h12l-1 8H7L6 9Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "free") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M4 9h16v10H4V9Zm8-5 2 2-2 2-2-2 2-2Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="m7 17 10-10M8.5 8.5h.01M15.5 15.5h.01" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8.5" cy="8.5" r="2" stroke={color} strokeWidth="1.4" />
      <circle cx="15.5" cy="15.5" r="2" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}
