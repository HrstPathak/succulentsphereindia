"use client";

import { useEffect, useRef } from "react";

type PurchaseItem = {
  item_id: string;
  item_name: string;
  item_category: string;
  price: number;
  quantity: number;
};

type PurchasePayload = {
  id: string;
  totalAmount: number;
  taxAmount?: number;
  shippingAmount?: number;
  items: PurchaseItem[];
};

type Props = {
  orderId: string;
  amount: number;
};

export default function PurchaseDataLayerEvent({ orderId, amount }: Props) {
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (hasFiredRef.current || typeof window === "undefined") return;

    let payload: PurchasePayload | null = null;
    try {
      const raw = sessionStorage.getItem("ss_purchase_payload");
      if (raw) {
        payload = JSON.parse(raw) as PurchasePayload;
      }
    } catch {
      payload = null;
    }

    const finalOrderId = String(orderId || payload?.id || "").trim();
    if (!payload || !finalOrderId || !Array.isArray(payload.items) || payload.items.length === 0) return;

    (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer =
      (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer || [];

    const dataLayerTarget = window as Window & { dataLayer?: Array<Record<string, unknown>> };

    // Clear previous ecommerce object to avoid stale payload bleed between events.
    dataLayerTarget.dataLayer!.push({ ecommerce: null });
    dataLayerTarget.dataLayer!.push({
      event: "purchase",
      ecommerce: {
        transaction_id: finalOrderId,
        currency: "INR",
        value: Number(payload.totalAmount || amount || 0),
        tax: Number(payload.taxAmount || 0),
        shipping: Number(payload.shippingAmount || 0),
        items: payload.items.map((item) => ({
          item_id: item.item_id,
          item_name: item.item_name,
          item_category: item.item_category,
          price: Number(item.price),
          quantity: Number(item.quantity || 1),
        })),
      },
    });

    hasFiredRef.current = true;
    sessionStorage.removeItem("ss_purchase_payload");
  }, [amount, orderId]);

  return null;
}
