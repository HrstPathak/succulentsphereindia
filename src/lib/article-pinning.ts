/**
 * Shared (client + server safe) helpers for "pinned to the home page" blogs.
 *
 * Several plant-care articles can be pinned at once. The admin list controls
 * their top-to-bottom order via the `pinnedOrder` field (0 = first in the home
 * page rail), and `pinnedAt` keeps track of when each blog was pinned.
 */

/** Minimal shape needed to sort pinned blogs the way the home page rail shows them. */
export type PinnedOrderEntry = {
  id: string;
  pinnedOrder?: number;
  pinnedAt?: string;
};

/** Hard cap on how many blogs can be pinned to the home page rail at once. */
export const MAX_PINNED_ARTICLES = 12;

/**
 * Blogs pinned before ordering existed have no `pinnedOrder`; they sort after
 * every explicitly ordered pin instead of jumping to the top (0).
 */
export function normalisePinnedOrder(value: unknown): number {
  if (value === null || value === undefined || value === "") return Number.MAX_SAFE_INTEGER;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

/** Top-to-bottom rail order: explicit `pinnedOrder` first, then most recently pinned. */
export function comparePinnedOrder(a: PinnedOrderEntry, b: PinnedOrderEntry): number {
  const orderA = normalisePinnedOrder(a.pinnedOrder);
  const orderB = normalisePinnedOrder(b.pinnedOrder);
  if (orderA !== orderB) return orderA - orderB;
  return String(b.pinnedAt || "").localeCompare(String(a.pinnedAt || ""));
}
