export type RecentlyViewedProduct = {
  id: string;
  handle: string;
  title: string;
  image: string;
  price: string;
  compareAtPrice?: string | null;
  currency?: string;
};

const STORAGE_KEY = "ss_recently_viewed_products";
const MAX_RECENT = 8;

function normalize(value: Partial<RecentlyViewedProduct>): RecentlyViewedProduct | null {
  const handle = String(value.handle || "").trim();
  const title = String(value.title || "").trim();
  if (!handle || !title) return null;

  const id = String(value.id || handle).trim();
  return {
    id: id || handle,
    handle,
    title,
    image: String(value.image || "/assets/product-1.jpg").trim() || "/assets/product-1.jpg",
    price: String(value.price || "0").trim() || "0",
    compareAtPrice: value.compareAtPrice ? String(value.compareAtPrice).trim() : null,
    currency: String(value.currency || "INR").trim() || "INR",
  };
}

export function getRecentlyViewedProducts(): RecentlyViewedProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalize(item as Partial<RecentlyViewedProduct>))
      .filter((item): item is RecentlyViewedProduct => Boolean(item))
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function rememberRecentlyViewedProduct(input: Partial<RecentlyViewedProduct>) {
  if (typeof window === "undefined") return;
  const product = normalize(input);
  if (!product) return;

  const current = getRecentlyViewedProducts();
  const deduped = current.filter((item) => item.handle !== product.handle && item.id !== product.id);
  const next = [product, ...deduped].slice(0, MAX_RECENT);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
