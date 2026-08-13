const MIN_ORDER_AMOUNT_ENV =
  process.env.NEXT_PUBLIC_MIN_ORDER_AMOUNT ?? process.env.MIN_ORDER_AMOUNT;
const MIN_ORDER_AMOUNT_PARSED = Number.parseFloat(MIN_ORDER_AMOUNT_ENV ?? "");
export const MIN_ORDER_AMOUNT =
  Number.isFinite(MIN_ORDER_AMOUNT_PARSED) && MIN_ORDER_AMOUNT_PARSED >= 0
    ? MIN_ORDER_AMOUNT_PARSED
    : 199;
export const FREE_DELIVERY_THRESHOLD = 599;
export const DISCOUNT_THRESHOLD = 999;
export const STANDARD_SHIPPING_CHARGE = 70;
export const DISCOUNT_RATE = 0.05;
export const FREE_SHIPPING_DISCOUNT_TITLE = "Free Shipping";
export const PERCENT_DISCOUNT_TITLE = "5% Discount";
export const FREE_SHIPPING_TAGS = ["free_shipping"];
export const FREE_SHIPPING_TAG_DISCOUNT_TITLE = "Combo Free Shipping";

type PricingItem = {
  tags?: string[];
};

function normalizeTag(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function hasFreeShippingTag(items?: PricingItem[]) {
  if (!items || items.length === 0) return false;
  const eligible = new Set(FREE_SHIPPING_TAGS.map(normalizeTag).filter(Boolean));
  if (eligible.size === 0) return false;
  return items.some((item) =>
    Array.isArray(item.tags) ? item.tags.some((tag) => eligible.has(normalizeTag(tag))) : false
  );
}

export function calculateOrderPricing(subtotal: number, items?: PricingItem[]) {
  const normalizedSubtotal = Number.isFinite(subtotal) ? Math.max(0, subtotal) : 0;
  const freeShippingByTag = hasFreeShippingTag(items);
  const freeShippingByThreshold = normalizedSubtotal >= FREE_DELIVERY_THRESHOLD;
  const hasFreeDelivery = freeShippingByThreshold || freeShippingByTag;
  const hasDiscount = normalizedSubtotal >= DISCOUNT_THRESHOLD;
  const baseShipping = STANDARD_SHIPPING_CHARGE;
  const shippingDiscount = hasFreeDelivery ? baseShipping : 0;
  const shipping = Math.max(0, baseShipping - shippingDiscount);
  const discount = hasDiscount ? Number((normalizedSubtotal * DISCOUNT_RATE).toFixed(2)) : 0;
  const total = Math.max(0, Number((normalizedSubtotal + shipping - discount).toFixed(2)));
  const freeShippingSource = freeShippingByTag ? "tag" : freeShippingByThreshold ? "threshold" : null;

  return {
    subtotal: normalizedSubtotal,
    baseShipping,
    shippingDiscount,
    shipping,
    discount,
    total,
    hasFreeDelivery,
    hasDiscount,
    freeShippingSource,
  };
}
