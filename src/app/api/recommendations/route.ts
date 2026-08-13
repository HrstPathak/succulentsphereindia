import { NextRequest, NextResponse } from "next/server";
import { rankProductsWithHF, type ProductRankingCandidate } from "@/lib/huggingface";
import { fetchProductsList, fetchRecommendationCandidates, type RecommendationProduct } from "@/lib/commerce";

type RecommendationRequest = {
  handle?: string;
  limit?: number;
};

type RecommendationResponseItem = {
  id: string;
  title: string;
  handle: string;
  price: string;
  compareAtPrice?: string | null;
  currency: string;
  image: string;
  imageAlt?: string;
  reason: string;
  score: number;
  available: boolean;
};

type CacheEntry = {
  expiresAt: number;
  recommendations: RecommendationResponseItem[];
};

const recommendationCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function toNum(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function overlapCount(left: string[], right: string[]): number {
  const rightSet = new Set(right.map((item) => item.toLowerCase()));
  let count = 0;
  for (const item of left) {
    if (rightSet.has(item.toLowerCase())) count += 1;
  }
  return count;
}

function toProductBlurb(description: unknown, fallback: string): string {
  const cleaned = String(description || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function fallbackReason(candidate: RecommendationProduct, current: RecommendationProduct): string {
  const reasons: string[] = [];
  if (candidate.category.toLowerCase() === current.category.toLowerCase()) reasons.push("same category");
  if (candidate.careLevel.toLowerCase() === current.careLevel.toLowerCase()) reasons.push("same care level");
  if (candidate.indoorOutdoor.toLowerCase() === current.indoorOutdoor.toLowerCase()) reasons.push(candidate.indoorOutdoor);
  if (candidate.available) reasons.push("in stock");
  return reasons.length > 0 ? `Matched by ${reasons.join(", ")}.` : "Matched by tags and price profile.";
}

function fallbackRank(current: RecommendationProduct, candidates: RecommendationProduct[], limit: number): RecommendationResponseItem[] {
  const currentPrice = toNum(current.price);
  return [...candidates]
    .map((candidate) => {
      const priceDelta = currentPrice > 0 ? Math.abs(toNum(candidate.price) - currentPrice) / currentPrice : 1;
      const score =
        (candidate.category.toLowerCase() === current.category.toLowerCase() ? 30 : 0) +
        (candidate.careLevel.toLowerCase() === current.careLevel.toLowerCase() ? 18 : 0) +
        (candidate.indoorOutdoor.toLowerCase() === current.indoorOutdoor.toLowerCase() ? 12 : 0) +
        Math.min(20, overlapCount(candidate.tags, current.tags) * 5) +
        Math.max(0, 15 - Math.round(priceDelta * 30)) +
        (candidate.available ? 8 : 0);

      return {
        id: candidate.id,
        title: candidate.title,
        handle: candidate.handle,
        price: candidate.price,
        compareAtPrice: candidate.compareAtPrice ?? null,
        currency: candidate.currency,
        image: candidate.image,
        imageAlt: candidate.imageAlt || candidate.title,
        reason: toProductBlurb(candidate.description, fallbackReason(candidate, current)),
        score: Math.max(0, Math.min(100, score)),
        available: candidate.available,
      } satisfies RecommendationResponseItem;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function toRankingInput(item: RecommendationProduct): ProductRankingCandidate {
  return {
    id: item.id,
    title: item.title,
    handle: item.handle,
    description: item.description,
    tags: item.tags,
    category: item.category,
    careLevel: item.careLevel,
    indoorOutdoor: item.indoorOutdoor,
    price: item.price,
    currency: item.currency,
    image: item.image,
    available: item.available,
  };
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function randomCatalogFallback(handle: string, limit: number): Promise<RecommendationResponseItem[]> {
  const products = (await fetchProductsList(30, { sortKey: "BEST_SELLING", reverse: false })) as Array<{
    id: string;
    title: string;
    handle: string;
    price: string;
    currency: string;
    image: string;
    imageAlt?: string;
    description?: string;
    available: boolean;
  }>;
  return shuffle(products)
    .filter((item) => item.handle && item.handle !== handle)
    .slice(0, limit)
    .map((item, idx) => ({
      id: item.id,
      title: item.title,
      handle: item.handle,
      price: item.price,
      compareAtPrice: (item as { compareAtPrice?: string | null }).compareAtPrice ?? null,
      currency: item.currency,
      image: item.image,
      imageAlt: item.imageAlt || item.title,
      reason: toProductBlurb(item.description, "Popular pick from our catalog."),
      score: Math.max(55, 80 - idx * 6),
      available: Boolean(item.available),
    }));
}

export async function POST(request: NextRequest) {
  let body: RecommendationRequest;
  try {
    body = (await request.json()) as RecommendationRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const handle = String(body?.handle || "").trim();
  if (!handle) {
    return NextResponse.json({ error: "Product handle is required." }, { status: 400 });
  }

  const limit = Math.max(1, Math.min(Number(body?.limit || 4), 4));
  const cacheKey = `${handle}:${limit}`;
  const now = Date.now();
  const cached = recommendationCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ recommendations: cached.recommendations, source: "cache" });
  }

  try {
    const { current, candidates } = await fetchRecommendationCandidates(handle, 30);
    if (!current || candidates.length === 0) {
      const recommendations = await randomCatalogFallback(handle, limit);
      recommendationCache.set(cacheKey, { recommendations, expiresAt: now + CACHE_TTL_MS });
      return NextResponse.json({ recommendations, source: "catalog-random" });
    }

    const selectedCandidates = candidates.slice(0, 30);
    const ranked = await rankProductsWithHF({
      currentProduct: toRankingInput(current),
      candidates: selectedCandidates.map(toRankingInput),
      limit,
    });

    const byHandle = new Map(selectedCandidates.map((candidate) => [candidate.handle, candidate]));
    const recommendations =
      ranked.length > 0
        ? ranked
            .map((entry) => {
              const candidate = byHandle.get(entry.handle);
              if (!candidate) return null;
              const mapped: RecommendationResponseItem = {
                id: candidate.id,
                title: candidate.title,
                handle: candidate.handle,
                price: candidate.price,
                compareAtPrice: candidate.compareAtPrice ?? null,
                currency: candidate.currency,
                image: candidate.image,
                imageAlt: candidate.imageAlt || candidate.title,
                reason: toProductBlurb(candidate.description, fallbackReason(candidate, current)),
                score: entry.score,
                available: candidate.available,
              };
              return mapped;
            })
            .filter((item): item is RecommendationResponseItem => item !== null)
            .slice(0, limit)
        : fallbackRank(current, selectedCandidates, limit);

    const result = recommendations.length > 0 ? recommendations : fallbackRank(current, selectedCandidates, limit);
    recommendationCache.set(cacheKey, { recommendations: result, expiresAt: now + CACHE_TTL_MS });

    return NextResponse.json({
      recommendations: result,
      source: ranked.length > 0 ? "model" : "fallback",
      filteredCount: selectedCandidates.length,
    });
  } catch {
    try {
      const recommendations = await randomCatalogFallback(handle, limit);
      recommendationCache.set(cacheKey, { recommendations, expiresAt: now + CACHE_TTL_MS });
      return NextResponse.json({ recommendations, source: "catalog-random" });
    } catch {
      return NextResponse.json({ recommendations: [], source: "fallback-empty" });
    }
  }
}
