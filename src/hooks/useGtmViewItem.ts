"use client";

import { useEffect, useRef } from "react";

type ViewItemProduct = {
  id?: string | number | null;
  title?: string | null;
  price?: string | number | null;
  category?: string | null;
  handle?: string | null;
};

declare global {
  interface Window {
    dataLayer: Array<Record<string, unknown>>;
  }
}

/**
 * Pushes a GA4 "view_item" ecommerce event to GTM dataLayer.
 * This hook is intended for product detail pages only.
 */
export function useGtmViewItem(product: ViewItemProduct) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (typeof window === "undefined") return;

    const itemId = String(product?.id || "").trim();
    const itemName = String(product?.title || "").trim();
    const itemCategory = String(product?.category || "").trim();
    const parsedPrice = Number(product?.price);
    const price = Number.isFinite(parsedPrice) ? parsedPrice : 0;

    // Do not push incomplete product impressions.
    if (!itemId || !itemName) return;

    window.dataLayer = window.dataLayer || [];
    // GA4 keeps previous ecommerce payload in memory; clear it before sending a new ecommerce event.
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({
      event: "view_item",
      ecommerce: {
        currency: "INR",
        value: price,
        items: [
          {
            item_id: itemId,
            item_name: itemName,
            item_category: itemCategory,
            price,
            quantity: 1,
          },
        ],
      },
    });

    firedRef.current = true;
  }, [product?.id, product?.title, product?.price, product?.category, product?.handle]);
}
