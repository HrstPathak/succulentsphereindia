import { chatWithHF } from "@/lib/huggingface";
import { mockProducts } from "@/data/mockProducts";
import { fetchAllProductsList, fetchProductsByQuery } from "@/lib/commerce";

export interface SuggestedPlant {
  id: string;
  title: string;
  handle: string;
  price: string;
  currency: string;
  image: string;
  reason: string;
  score: number;
  available: boolean;
}

type CandidatePlant = {
  id: string;
  title: string;
  handle: string;
  type: string;
  price: string;
  currency: string;
  image: string;
  careLevel: string;
  available: boolean;
  tags: string[];
  description: string;
  rating: number;
};

type ModelSuggestion = {
  handle: string;
  reason: string;
  score: number;
};

function sanitizeUserMessage(input: string): string {
  return String(input || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCandidate(raw: any): CandidatePlant {
  return {
    id: String(raw?.id || ""),
    title: String(raw?.title || "Untitled"),
    handle: String(raw?.handle || ""),
    type: String(raw?.type || "General"),
    price: String(raw?.price || "0.00"),
    currency: String(raw?.currency || "USD"),
    image: String(raw?.image || "/assets/product-1.jpg"),
    careLevel: String(raw?.careLevel || ""),
    available: Boolean(raw?.available ?? raw?.availability !== "OutOfStock"),
    tags: Array.isArray(raw?.tags) ? raw.tags.map((tag: unknown) => String(tag)) : [],
    description: String(raw?.description || ""),
    rating: toNumber(raw?.rating, 4.4),
  };
}

function extractJsonObject(input: string): string | null {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return input.slice(start, end + 1);
}

function toSuggestions(raw: unknown): ModelSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => ({
      handle: String((entry as { handle?: string })?.handle || "").trim(),
      reason: String((entry as { reason?: string })?.reason || "").trim(),
      score: Math.max(0, Math.min(100, Math.round(toNumber((entry as { score?: number })?.score, 0)))),
    }))
    .filter((entry) => entry.handle.length > 0 && entry.reason.length > 0);
}

function fallbackScore(product: CandidatePlant, userMessage: string): number {
  const text = `${product.title} ${product.type} ${product.careLevel} ${product.tags.join(" ")} ${product.description}`.toLowerCase();
  const tokens = userMessage
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);

  let tokenScore = 0;
  for (const token of tokens) {
    if (text.includes(token)) tokenScore += 12;
  }

  const stockBonus = product.available ? 8 : -12;
  const ratingBonus = Math.round(product.rating * 8);
  return Math.max(0, Math.min(100, tokenScore + stockBonus + ratingBonus));
}

function fallbackReason(product: CandidatePlant): string {
  const parts = [];
  if (product.careLevel) parts.push(`${product.careLevel} care profile`);
  if (product.type) parts.push(`${product.type} style`);
  if (product.available) parts.push("currently in stock");
  return parts.length > 0 ? `Matches your preferences with a ${parts.join(", ")}.` : "Strong fit based on your request.";
}

async function fetchCandidates(userMessage: string): Promise<CandidatePlant[]> {
  const safeMessage = sanitizeUserMessage(userMessage);
  const hasSearchQuery = safeMessage.length >= 3;

  try {
    if (hasSearchQuery) {
      const products = await fetchProductsByQuery(safeMessage, { first: 30, sortKey: "BEST_SELLING", reverse: false });
      const mapped = (products?.edges || []).map((edge: any) =>
        normalizeCandidate({
          ...edge?.node,
          type: edge?.node?.productType,
          careLevel: edge?.node?.metafield?.value || "",
          image: edge?.node?.images?.edges?.[0]?.node?.url || "/assets/product-1.jpg",
          price: edge?.node?.variants?.edges?.[0]?.node?.price?.amount
            || edge?.node?.variants?.edges?.[0]?.node?.priceV2?.amount
            || "0.00",
          currency: edge?.node?.variants?.edges?.[0]?.node?.price?.currencyCode
            || edge?.node?.variants?.edges?.[0]?.node?.priceV2?.currencyCode
            || "USD",
          available: edge?.node?.availableForSale,
        })
      );
      if (mapped.length > 0) return mapped;
    }

    const all = await fetchAllProductsList({ sortKey: "BEST_SELLING", reverse: false });
    return all.slice(0, 40).map((item: any) => normalizeCandidate(item));
  } catch {
    return mockProducts.map((item) =>
      normalizeCandidate({
        ...item,
        type: "Succulent",
        careLevel: "Beginner",
        available: item.availability !== "OutOfStock",
      })
    );
  }
}

async function rankWithModel(
  userMessage: string,
  candidates: CandidatePlant[],
  apiKey: string
): Promise<ModelSuggestion[]> {
  const compactCandidates = candidates.map((product) => ({
    handle: product.handle,
    title: product.title,
    type: product.type,
    careLevel: product.careLevel || "General",
    price: product.price,
    currency: product.currency,
    available: product.available,
    tags: product.tags.slice(0, 6),
    rating: product.rating,
  }));

  const systemPrompt =
    "You are a plant recommendation engine for SucculentSphere. Respond with only valid JSON.";
  const userPrompt = `User request: "${sanitizeUserMessage(userMessage)}"

Candidates:
${JSON.stringify(compactCandidates)}

Return JSON only:
{
  "suggestions": [
    { "handle": "product-handle", "reason": "short reason", "score": 0-100 }
  ]
}

Rules:
- Pick exactly 5 suggestions.
- Use only handles from candidates.
- Prefer in-stock products.
- Reasons must be concise and specific to user intent.
- Score reflects fitness to the user request.`;

  const completion = await chatWithHF(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { apiKey, temperature: 0.15, maxNewTokens: 700 }
  );

  const jsonBlock = extractJsonObject(completion);
  if (!jsonBlock) return [];
  try {
    const parsed = JSON.parse(jsonBlock) as { suggestions?: unknown };
    return toSuggestions(parsed?.suggestions).slice(0, 5);
  } catch {
    return [];
  }
}

export async function generatePlantSuggestions(
  userMessage: string
): Promise<{ suggestions: SuggestedPlant[]; source: "model" | "fallback" }> {
  const candidates = await fetchCandidates(userMessage);
  if (candidates.length === 0) {
    return { suggestions: [], source: "fallback" };
  }

  const byHandle = new Map(candidates.map((candidate) => [candidate.handle, candidate]));
  const apiKey = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || "";

  if (apiKey) {
    try {
      const modelSuggestions = await rankWithModel(userMessage, candidates, apiKey);
      const hydrated = modelSuggestions
        .map((entry) => {
          const candidate = byHandle.get(entry.handle);
          if (!candidate) return null;
          return {
            id: candidate.id,
            title: candidate.title,
            handle: candidate.handle,
            price: candidate.price,
            currency: candidate.currency,
            image: candidate.image,
            reason: entry.reason,
            score: entry.score,
            available: candidate.available,
          } satisfies SuggestedPlant;
        })
        .filter((item): item is SuggestedPlant => item !== null);

      if (hydrated.length > 0) {
        return { suggestions: hydrated.slice(0, 5), source: "model" };
      }
    } catch {}
  }

  const fallback = [...candidates]
    .map((candidate) => ({
      product: candidate,
      score: fallbackScore(candidate, userMessage),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ product, score }) => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      price: product.price,
      currency: product.currency,
      image: product.image,
      reason: fallbackReason(product),
      score,
      available: product.available,
    }));

  return { suggestions: fallback, source: "fallback" };
}
