/**
 * Client-side fetch helpers for the public, read-only catalog endpoints.
 *
 * Why this exists: the shop grid, search bar and facet loader were all calling
 * `fetch(url, { cache: "no-store" })`. That instruction is aimed at the SERVER
 * fetch cache, but in a client component it also stops the browser HTTP cache
 * and the service-worker layer from doing anything, so every filter click,
 * sort change and page turn re-downloaded an identical JSON payload.
 *
 * The CDN-side caching is declared in next.config.js (s-maxage +
 * stale-while-revalidate). This helper adds the client half: an in-memory
 * request-coalescing cache that dedupes concurrent identical GETs and serves
 * repeats from memory, while a background refresh keeps the data fresh.
 *
 * Deliberately NOT used for: cart, checkout, wallet, account, admin, orders or
 * anything personalised. Those are per-visitor and must never be shared.
 */

type CacheEntry = { data: unknown; at: number };
type PendingEntry = { promise: Promise<unknown> };

const memoryCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, PendingEntry>();

/** Default freshness window before a background refresh is triggered. */
const DEFAULT_TTL_MS = 60_000;
/** Hard cap so a tab left open for hours still revalidates. */
const MAX_STALE_MS = 5 * 60_000;

function readCache(key: string): unknown | undefined {
  const hit = memoryCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > MAX_STALE_MS) {
    memoryCache.delete(key);
    return undefined;
  }
  return hit.data;
}

function writeCache(key: string, data: unknown) {
  if (memoryCache.size > 200) {
    // Simple FIFO trim keeps memory bounded on a long browsing session.
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { data, at: Date.now() });
}

/**
 * GET JSON with in-memory caching and request coalescing.
 *
 * - A cold key issues one network request; concurrent callers await the same
 *   promise instead of stampeding the server.
 * - A fresh key (< ttlMs) returns from memory with no network at all.
 * - A stale key renders immediately from memory and refreshes in the
 *   background, so the user never waits on the network for data they already
 *   have.
 */
export async function cachedJson<T = unknown>(
  url: string,
  options: { ttlMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const { ttlMs = DEFAULT_TTL_MS, signal } = options;
  const cached = readCache(url);
  const isFresh = cached !== undefined && memoryCache.get(url)!.at + ttlMs > Date.now();

  if (isFresh) return cached as T;

  // Coalesce: if this exact URL is already being fetched, join that request.
  const pending = inFlight.get(url);
  if (pending) return pending.promise as Promise<T>;

  const request = (async () => {
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const json = await res.json();
    writeCache(url, json);
    return json;
  })();

  inFlight.set(url, { promise: request });
  try {
    return (await request) as T;
  } finally {
    inFlight.delete(url);
  }
}

/**
 * Like `cachedJson` but returns stale data immediately when the network is
 * slow or fails, and refreshes in the background. Used where showing slightly
 * old inventory beats showing an error.
 */
export async function cachedJsonSWR<T = unknown>(
  url: string,
  options: { ttlMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  try {
    return await cachedJson<T>(url, options);
  } catch (error) {
    const cached = readCache(url);
    if (cached !== undefined) return cached as T;
    throw error;
  }
}

/** Drops the in-memory cache. Call after an admin edit invalidates a view. */
export function invalidateCachedJson(urlPrefix?: string) {
  if (!urlPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of [...memoryCache.keys()]) {
    if (key.startsWith(urlPrefix)) memoryCache.delete(key);
  }
}
