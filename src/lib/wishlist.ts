export const WISHLIST_STORAGE_KEY = "ss_wishlist_v1";

/** Upper bound shared by the API route and the server-rendered wishlist seed. */
export const WISHLIST_MAX_IDS = 100;

export type WishlistProduct = {
  id: string;
  title: string;
  handle: string;
  image: string;
  imageAlt?: string;
  price: string;
  compareAtPrice?: string | null;
  currency: string;
  available: boolean;
};

export function normalizeWishlistIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of input) {
    const id = String(value || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function parseWishlistMetafield(value?: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toWishlistMetafieldValue(ids: string[]): string {
  return JSON.stringify(normalizeWishlistIds(ids));
}

export function mergeWishlistIds(base: string[], incoming: string[]): string[] {
  if (!incoming.length) return normalizeWishlistIds(base);
  if (!base.length) return normalizeWishlistIds(incoming);
  return normalizeWishlistIds([...incoming, ...base]);
}

export function toggleWishlistId(ids: string[], productId: string) {
  const normalized = normalizeWishlistIds(ids);
  const target = String(productId || "").trim();
  if (!target) return { nextIds: normalized, added: false };
  const exists = normalized.includes(target);
  if (exists) {
    return { nextIds: normalized.filter((id) => id !== target), added: false };
  }
  return { nextIds: [target, ...normalized], added: true };
}

export function removeWishlistId(ids: string[], productId: string) {
  const normalized = normalizeWishlistIds(ids);
  const target = String(productId || "").trim();
  return normalized.filter((id) => id !== target);
}

export function readGuestWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    return normalizeWishlistIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeGuestWishlist(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(normalizeWishlistIds(ids)));
  } catch {
    // no-op
  }
}

export function clearGuestWishlist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(WISHLIST_STORAGE_KEY);
  } catch {
    // no-op
  }
}

/**
 * Shape of a catalog product as it reaches the wishlist layer. Kept structural
 * (no import from the server-only commerce module) so this file stays usable
 * from both client components and route handlers.
 */
type WishlistProductSource = {
  id?: unknown;
  title?: unknown;
  handle?: unknown;
  image?: unknown;
  imageAlt?: unknown;
  price?: unknown;
  compareAtPrice?: unknown;
  currency?: unknown;
  available?: unknown;
};

/**
 * Trim a full catalog product down to what the wishlist grid renders.
 *
 * Wishlist responses used to serialize whole product documents — descriptions
 * (plain + HTML), FAQ lists, every gallery image — for a row of 96px
 * thumbnails. Both the API payload and the server-rendered seed now go through
 * this projection, which cuts the JSON the /wishlist page has to parse and keep
 * in memory.
 */
export function toWishlistProduct(product: WishlistProductSource | null | undefined): WishlistProduct | null {
  if (!product) return null;

  const id = String(product.id || "").trim();
  if (!id) return null;

  const compareAtPrice = product.compareAtPrice == null || product.compareAtPrice === "" ? null : String(product.compareAtPrice);

  return {
    id,
    title: String(product.title || "Untitled Product"),
    handle: String(product.handle || ""),
    image: String(product.image || ""),
    imageAlt: product.imageAlt ? String(product.imageAlt) : undefined,
    price: String(product.price ?? "0.00"),
    compareAtPrice,
    currency: String(product.currency || "INR"),
    available: product.available !== false,
  };
}

export function toWishlistProducts(products: unknown): WishlistProduct[] {
  if (!Array.isArray(products)) return [];
  return products
    .map((product) => toWishlistProduct(product as WishlistProductSource))
    .filter((product): product is WishlistProduct => Boolean(product));
}
