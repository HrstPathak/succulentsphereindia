export const WISHLIST_STORAGE_KEY = "ss_wishlist_v1";

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
  return normalizeWishlistIds([...base, ...incoming]);
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
