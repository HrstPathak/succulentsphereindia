import { Redis } from "@upstash/redis";

type CachedToken = {
  access_token: string;
  expires_at: string;
};

const TOKEN_KEY = "shopify:admin:token";
const EXPIRY_SKEW_SECONDS = 300;

function normalizeStoreDomain(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .split("/")[0];
}

function getRedisClient(): Redis | null {
  const url = String(
    process.env.KV_REST_API_URL ||
      process.env.UPSTASH_REDIS_REST_URL ||
      ""
  ).trim();
  const token = String(
    process.env.KV_REST_API_TOKEN ||
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      ""
  ).trim();
  if (!url || !token) return null;
  return Redis.fromEnv();
}

function isExpiringSoon(expiresAt: string, skewSeconds = EXPIRY_SKEW_SECONDS): boolean {
  if (!expiresAt) return true;
  const ms = Date.parse(expiresAt);
  if (!Number.isFinite(ms)) return true;
  return ms - Date.now() <= skewSeconds * 1000;
}

function toIsoExpiry(expiresIn?: number): string {
  const ttl = Number.isFinite(Number(expiresIn)) ? Math.max(60, Number(expiresIn)) : 3600;
  return new Date(Date.now() + ttl * 1000).toISOString();
}

async function requestNewToken(): Promise<{ accessToken: string; expiresAt: string }> {
  const shop = normalizeStoreDomain(process.env.SHOPIFY_STORE_DOMAIN || "");
  const clientId = String(process.env.SHOPIFY_ADMIN_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.SHOPIFY_ADMIN_CLIENT_SECRET || "").trim();

  if (!shop) {
    throw new Error("Missing SHOPIFY_STORE_DOMAIN.");
  }
  if (!clientId || !clientSecret) {
    throw new Error("Missing Shopify admin OAuth credentials. Set SHOPIFY_ADMIN_CLIENT_ID and SHOPIFY_ADMIN_CLIENT_SECRET.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(json?.error_description || json?.error || "Shopify admin token request failed."));
  }

  const accessToken = String(json?.access_token || "").trim();
  if (!accessToken) {
    throw new Error("Shopify admin token response missing access_token.");
  }

  const expiresAt = toIsoExpiry(Number(json?.expires_in || 0));
  return { accessToken, expiresAt };
}

export async function getShopifyAdminAccessToken(): Promise<string> {
  const directToken = String(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim();
  const hasOauth = Boolean(process.env.SHOPIFY_ADMIN_CLIENT_ID && process.env.SHOPIFY_ADMIN_CLIENT_SECRET);
  const redis = getRedisClient();

  if (!hasOauth || !redis) {
    if (directToken) return directToken;
    if (!hasOauth) {
      throw new Error("Missing Shopify admin OAuth credentials. Set SHOPIFY_ADMIN_CLIENT_ID and SHOPIFY_ADMIN_CLIENT_SECRET.");
    }
    throw new Error("Missing Upstash Redis credentials. Set KV_REST_API_URL and KV_REST_API_TOKEN.");
  }

  const cached = await redis.get<CachedToken>(TOKEN_KEY);
  if (cached?.access_token && cached?.expires_at && !isExpiringSoon(cached.expires_at)) {
    return cached.access_token;
  }

  const fresh = await requestNewToken();
  const payload: CachedToken = { access_token: fresh.accessToken, expires_at: fresh.expiresAt };
  await redis.set(TOKEN_KEY, payload);
  return fresh.accessToken;
}
