import "server-only";

import { cacheDelete, cacheGet, cacheSet } from "@/lib/redis";

/**
 * Shared cache for the admin dashboard's row-list scopes.
 *
 * The Command Center already stopped deriving its counters live (they live in
 * one `adminStats/overview` document — see admin-stats.ts), and each tab is
 * fetched only when opened. What remains is that opening a tab still issues a
 * full collection read:
 *
 *   products   -> 147 reads
 *   orders     ->   3 reads
 *   customers  ->  15 reads
 *   reviews    -> 120 reads
 *
 * The operator opens these tabs repeatedly to check on things, and Vercel
 * recycles instances, so the same query re-ran far more often than the data
 * actually changed. Redis makes the second and every later open free.
 *
 * Deliberately NOT cached:
 *   - the summary counters. That path is already a single document read, and
 *     Redis would only add a hop in front of it.
 *   - order/product DETAIL endpoints. Those are single-document reads, they
 *     back individual actions, and a stale detail view is actively harmful.
 *   - anything before requireAdmin() has passed. The cache is shared, so
 *     populating it from an unauthenticated request would be a data leak.
 *
 * The TTL is short and deliberately so. Unlike the storefront catalog — where
 * stale-by-a-minute is invisible — an admin looking at the Orders tab expects
 * the numbers they just caused to be there. Admin mutations call
 * `invalidateAdminScopes()` so an edit is visible immediately; the TTL is only
 * the safety net for writes made outside the dashboard (a new order arriving
 * from the Razorpay webhook, say).
 */

const PREFIX = "admin:dashboard:v1:";

export const ADMIN_SCOPES = ["products", "orders", "customers", "reviews"] as const;
export type AdminScope = (typeof ADMIN_SCOPES)[number];

const key = (scope: AdminScope) => `${PREFIX}${scope}`;

/** Short TTL: correctness beats hit rate for an operator's own data. */
const ADMIN_SCOPE_TTL_SECONDS = 60;

/** Drops one or more cached tab payloads. Fire-and-forget, never throws. */
export function invalidateAdminScopes(...scopes: AdminScope[]): void {
  if (!scopes.length) return;
  void cacheDelete(...scopes.map(key));
}

/**
 * Read-through for a tab payload.
 *
 * Returns the cached rows when present, otherwise runs `load()`, stores the
 * result, and returns it. If Redis is unavailable this is exactly the old
 * behaviour — one Firestore read per request.
 */
export async function cachedAdminScope<T>(scope: AdminScope, load: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key(scope));
  // `null` is never a valid tab payload, so it is an unambiguous cache miss
  // and a genuine "no rows yet" is cached as the object it arrives in.
  if (hit !== null && hit !== undefined) return hit;

  const fresh = await load();
  void cacheSet(key(scope), fresh, ADMIN_SCOPE_TTL_SECONDS);
  return fresh;
}
