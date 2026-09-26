import "server-only";

import { Redis } from "@upstash/redis";

/**
 * Shared Upstash Redis access for server code.
 *
 * The project already owns a free Upstash database (KV_REST_API_URL /
 * KV_REST_API_TOKEN) and reads it directly in `metaFeed.ts` and
 * `api/meta/catalog/route.ts`. Those two built their own client, and the
 * catalog needed a third copy; this module is the single place that owns the
 * connection instead.
 *
 * Every helper here is fail-soft. A cache is an optimisation, never a
 * dependency: if the env vars are missing, the network is down, or Upstash
 * returns an error, the caller must transparently fall back to Firestore and
 * the page must still render. A shop that cannot show its products because a
 * cache is unreachable is strictly worse than a shop that reads Firestore
 * directly, so nothing in this file is allowed to throw.
 */

let client: Redis | null = null;
let initialised = false;

function envValue(name: string): string {
  return String(process.env[name] || "").trim();
}

/** Returns the shared client, or null when Redis is not configured. */
export function getRedis(): Redis | null {
  if (initialised) return client;
  initialised = true;

  const url = envValue("KV_REST_API_URL");
  const token = envValue("KV_REST_API_TOKEN");
  if (!url || !token) {
    client = null;
    return client;
  }

  try {
    client = new Redis({ url, token });
  } catch {
    client = null;
  }
  return client;
}

/** True when a cache read can be expected to work at all. */
export function isRedisConfigured(): boolean {
  return Boolean(getRedis());
}

function ttlSeconds(): number {
  const parsed = Number.parseInt(envValue("CACHE_TTL_SECONDS"), 10);
  // Default one hour. Long enough that a burst of traffic never re-reads
  // Firestore, short enough that an invalidated key is never missed forever.
  if (!Number.isFinite(parsed) || parsed <= 0) return 3600;
  return Math.min(parsed, 60 * 60 * 24);
}

/**
 * Reads and JSON-parses a cached value.
 * Returns null on a miss, on malformed JSON, or on any Redis failure.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await redis.get(key);
    if (raw == null) return null;
    // Upstash auto-parses JSON on the way out, so a stored object may already
    // be an object. Anything else is treated as an opaque string.
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      if (!/^[[{]/.test(trimmed)) return raw as unknown as T;
      try {
        return JSON.parse(trimmed) as T;
      } catch {
        return null;
      }
    }
    return raw as T;
  } catch {
    return null;
  }
}

/**
 * Serialises and stores a value with a TTL.
 * Silently no-ops when Redis is unavailable — a failed cache write must never
 * fail the request that triggered it.
 */
export async function cacheSet(key: string, value: unknown, ttl?: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const seconds = Number.isFinite(ttl) && Number(ttl) > 0 ? Math.trunc(Number(ttl)) : ttlSeconds();

  try {
    await redis.set(key, JSON.stringify(value ?? null), { ex: seconds });
  } catch {
    // Intentionally ignored: the caller already has its live data.
  }
}

/** Deletes one or more keys. Never throws. */
export async function cacheDelete(...keys: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || !keys.length) return;
  try {
    await redis.del(...keys);
  } catch {
    // Intentionally ignored: a stale key is bounded by its TTL.
  }
}
