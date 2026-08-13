"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Box, Leaf, PackageCheck, Truck } from "lucide-react";
import type { FirebaseCustomerOrder } from "@/lib/commerce";
import { resolveShippingPresentation } from "@/lib/shippingProgress";

type Props = {
  orders: FirebaseCustomerOrder[];
  maxItems?: number;
  className?: string;
};

function formatOrderDate(value: string) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatOrderTotal(amount: string, currencyCode: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currencyCode} ${amount}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(value);
}

const SHIPPING_STEPS = [
  { title: "Order Confirmed", Icon: BadgeCheck },
  { title: "In Process", Icon: Box },
  { title: "Shipped", Icon: Truck },
  { title: "Out for Delivery", Icon: PackageCheck },
  { title: "Delivered", Icon: Leaf },
] as const;

function getOrderPresentation(order: FirebaseCustomerOrder) {
  return resolveShippingPresentation({
    fulfillmentStatus: order.fulfillmentStatus,
    fulfillmentOrderStatuses: order.fulfillmentOrderStatuses,
    hasTracking: Array.isArray(order.tracking) && order.tracking.some((entry) => entry?.number || entry?.url),
    tags: order.tags,
    fulfillmentEvents: order.fulfillmentEvents,
  });
}

export default function OrdersListClient({ orders, maxItems, className }: Props) {
  const router = useRouter();
  const visibleOrders = useMemo(
    () => (typeof maxItems === "number" && maxItems > 0 ? orders.slice(0, maxItems) : orders),
    [maxItems, orders]
  );

  return (
    <div className={`${className || "mt-6"} grid gap-4`}>
      {visibleOrders.map((order) => {
        const presentation = getOrderPresentation(order);
        const step = presentation.step;
        const totalItems = order.lineItems.reduce((sum, item) => sum + Math.max(1, item.quantity || 1), 0);
        const paidAmount = formatOrderTotal(order.totalPrice.amount, order.totalPrice.currencyCode);
        const orderHref = `/account/orders/${encodeURIComponent(String(order.orderNumber || "").trim())}`;

        return (
          <article
            key={order.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(orderHref)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(orderHref);
              }
            }}
            className="cursor-pointer overflow-hidden rounded-2xl border border-[#e2d7c8] bg-[linear-gradient(150deg,#fff9ef_0%,#f5efe5_55%,#edf4ea_100%)] shadow-[0_18px_45px_-34px_rgba(53,69,58,0.75)] transition hover:shadow-[0_24px_52px_-32px_rgba(53,69,58,0.85)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/40"
          >
            <div className="border-b border-[#ebe1d2] px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#6b766a]">ORDER</p>
                  <p className="mt-1 text-xl font-semibold text-[var(--color-brand)]">#{order.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#6e7568]">{formatOrderDate(order.processedAt)}</p>
                  <p className="mt-1 text-sm font-semibold text-[#2b3f34]">{presentation.label}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[#3f4f45]">
                  Total: <span className="font-semibold text-[#22342b]">{paidAmount}</span>
                </p>
                <Link
                  href={`${orderHref}#products`}
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-lg border border-[#d2c5b4] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#2f4338] transition hover:bg-white"
                >
                  View products ({totalItems})
                </Link>
              </div>

                <div className="space-y-2 rounded-xl border border-[#e8dece] bg-white/60 p-3">
                  <div className="grid grid-cols-5 gap-1">
                  {SHIPPING_STEPS.map((shippingStep, index) => {
                    const done = index <= step;
                    const Icon = shippingStep.Icon;
                    return (
                      <div key={shippingStep.title} className="relative flex justify-center">
                        {index < SHIPPING_STEPS.length - 1 && (
                          <span
                            className={`absolute left-[58%] top-[15px] h-[2px] w-[88%] ${
                              done ? "bg-[var(--color-brand)]" : "bg-[#cfd7ca]"
                            }`}
                          />
                        )}
                        <div
                          className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border ${
                            done
                              ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                              : "border-[#cfd7ca] bg-[#e7ece2] text-[#6a7c70]"
                          }`}
                        >
                          <Icon size={14} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[12px] font-semibold text-[#2f4438]">{presentation.label}</p>
                  <p className="text-[11px] text-[#6b766a]">{presentation.trackerCaption}</p>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
