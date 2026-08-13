"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/currency";
import {
  calculateOrderPricing,
  FREE_SHIPPING_TAG_DISCOUNT_TITLE,
  FREE_SHIPPING_DISCOUNT_TITLE,
  PERCENT_DISCOUNT_TITLE,
} from "@/lib/pricing";

export default function CartSummary({
  items,
  onApplyCoupon,
  canCheckout = true,
  minOrderAmount = 0
}: {
  items: { id: string; title: string; itemCategory?: string; price: string; quantity: number; tags?: string[] }[];
  onApplyCoupon?: (code: string) => void;
  canCheckout?: boolean;
  minOrderAmount?: number;
}) {
  const router = useRouter();
  const subtotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.price) * it.quantity, 0),
    [items]
  );
  const pricing = useMemo(() => calculateOrderPricing(subtotal, items), [subtotal, items]);
  const shippingDisplay = pricing.shippingDiscount > 0 ? pricing.baseShipping : pricing.shipping;
  const freeShippingLabel =
    pricing.freeShippingSource === "tag" ? FREE_SHIPPING_TAG_DISCOUNT_TITLE : FREE_SHIPPING_DISCOUNT_TITLE;

  return (
    <aside className="bg-white rounded-lg p-6 shadow-sm w-full md:w-96">
      <div className="text-sm mb-4">
        <div className="font-semibold text-lg">Cart Totals</div>
      </div>
      <div className="flex justify-between mb-2">
        <div className="text-sm">Subtotal</div>
        <div className="text-sm font-medium">{formatINR(subtotal)}</div>
      </div>

      <div className="mt-4">
        <label className="sr-only" htmlFor="coupon">Coupon code</label>
        <div className="flex gap-2">
          <input id="coupon" name="coupon" placeholder="Enter coupon code" className="flex-1 border rounded px-3 py-2 text-sm" />
          <button className="bg-[var(--color-brand)] text-white px-3 py-2 rounded text-sm" onClick={() => onApplyCoupon?.("DISCOUNT")}>Apply</button>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-sm text-gray-600 mb-2">Shipping</div>
        <div className="text-sm">{shippingDisplay === 0 ? "Free" : formatINR(shippingDisplay, 0)}</div>
      </div>
      {pricing.shippingDiscount > 0 && (
        <div className="mt-2 flex items-center justify-between">
          <div className="text-sm text-green-700">{freeShippingLabel}</div>
          <div className="text-sm font-medium text-green-700">-{formatINR(pricing.shippingDiscount, 0)}</div>
        </div>
      )}

      {pricing.discount > 0 && (
        <div className="mt-2 flex items-center justify-between">
          <div className="text-sm text-green-700">Discount (5%)</div>
          <div className="text-sm font-medium text-green-700">-{formatINR(pricing.discount)}</div>
        </div>
      )}
      {/* {pricing.hasDiscount && (
        <div className="mt-1 text-xs text-green-700">
          {PERCENT_DISCOUNT_TITLE}
        </div>
      )} */}

      <div className="mt-4 border-t pt-3 flex items-center justify-between">
        <div className="text-sm font-semibold">Estimated Total</div>
        <div className="text-sm font-semibold">{formatINR(pricing.total)}</div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => {
            if (!canCheckout) return;

            // GTM/GA4 checkout click tracking from cart.
            if (typeof window !== "undefined") {
              const checkoutItems = items
                .map((line) => {
                  const itemId = String(line.id || "").trim();
                  const itemName = String(line.title || "").trim();
                  const itemCategory = String(line.itemCategory || "").trim();
                  const price = Number(line.price);
                  const quantity = Number(line.quantity || 1);
                  if (!itemId || !itemName || !price) return null;
                  return {
                    item_id: itemId,
                    item_name: itemName,
                    item_category: itemCategory,
                    price,
                    quantity,
                  };
                })
                .filter((line): line is { item_id: string; item_name: string; item_category: string; price: number; quantity: number } => line !== null);

              if (checkoutItems.length > 0) {
                const dataLayerTarget = window as Window & { dataLayer?: Array<Record<string, unknown>> };
                dataLayerTarget.dataLayer = dataLayerTarget.dataLayer || [];
                dataLayerTarget.dataLayer.push({ ecommerce: null });
                dataLayerTarget.dataLayer.push({
                  event: "begin_checkout",
                  ecommerce: {
                    currency: "INR",
                    value: pricing.total,
                    items: checkoutItems,
                  },
                });
              }
            }

            router.push("/checkout");
          }}
          disabled={!canCheckout}
          className={`w-full py-3 rounded text-sm transition ${canCheckout ? "bg-[var(--color-brand)] text-white" : "bg-gray-300 text-gray-600 cursor-not-allowed"}`}
        >
          Proceed to Checkout
        </button>
        {!canCheckout && (
          <p className="mt-2 text-xs text-red-600">Minimum order is {formatINR(minOrderAmount, 0)}. Add more items to continue.</p>
        )}
      </div>

    </aside>
  );
}

