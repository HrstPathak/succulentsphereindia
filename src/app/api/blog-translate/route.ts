import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { TranslationPayload, TranslationResponse } from "@/lib/blog-translation";
import { normalizeTranslationPayload, translateBlogArticle } from "@/lib/blog-translation";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const translationRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const translationCache = new Map<string, { data: TranslationResponse; provider: string; expiresAt: number }>();

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = translationRateLimitMap.get(ip);
  if (!entry) return false;
  if (now > entry.resetAt) {
    translationRateLimitMap.delete(ip);
    return false;
  }
  return entry.count >= RATE_LIMIT_MAX;
}

function recordRequest(ip: string): void {
  const now = Date.now();
  const entry = translationRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    translationRateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function createCacheKey(payload: TranslationPayload): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many translation requests. Please wait a moment." }, { status: 429 });
  }

  let body: Partial<TranslationPayload>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const payload = normalizeTranslationPayload(body);

  if (!payload.title || !payload.contentHtml) {
    return NextResponse.json({ error: "Article title and content are required." }, { status: 400 });
  }

  recordRequest(ip);

  const cacheKey = createCacheKey(payload);
  const cached = translationCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({
      ...cached.data,
      provider: cached.provider,
      cached: true,
    });
  }

  try {
    const translated = await translateBlogArticle(payload);
    translationCache.set(cacheKey, {
      data: translated.data,
      provider: translated.provider,
      expiresAt: now + CACHE_TTL_MS,
    });

    return NextResponse.json({
      ...translated.data,
      provider: translated.provider,
      cached: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    console.error("[blog-translate] error:", message);

    if (message.includes("timeout")) {
      return NextResponse.json(
        { error: "Translation is taking longer than usual. Please try again in a moment." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "We couldn't translate this article right now. Please try again shortly." },
      { status: 500 }
    );
  }
}
