/**
 * Hugging Face Inference API via router.huggingface.co (Chat Completions)
 * Uses: meta-llama/Llama-3.1-8B-Instruct, Qwen/Qwen2.5-7B-Instruct, or similar
 * Old api-inference.huggingface.co is deprecated (410)
 */

const ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.1-8B-Instruct";
const getModel = () => process.env.HF_MODEL || DEFAULT_MODEL;
const FALLBACK_MODELS = [DEFAULT_MODEL, "Qwen/Qwen2.5-7B-Instruct"];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ProductRankingCandidate {
  id: string;
  title: string;
  handle: string;
  description: string;
  tags: string[];
  category: string;
  careLevel: string;
  indoorOutdoor: string;
  price: string;
  currency: string;
  image: string;
  available: boolean;
}

export interface ProductRankingResult {
  handle: string;
  score: number;
  reason: string;
}

function extractJsonObject(input: string): string | null {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return input.slice(start, end + 1);
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeRanked(raw: unknown, allowedHandles: Set<string>, limit: number): ProductRankingResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => ({
      handle: String((entry as { handle?: string })?.handle || "").trim(),
      score: Math.max(0, Math.min(100, Math.round(safeNumber((entry as { score?: number })?.score, 0)))),
      reason: String((entry as { reason?: string })?.reason || "").trim().slice(0, 220),
    }))
    .filter((entry) => entry.handle && allowedHandles.has(entry.handle))
    .slice(0, limit);
}

export async function chatWithHF(
  messages: { role: string; content: string }[],
  options: {
    apiKey: string;
    temperature?: number;
    maxNewTokens?: number;
  }
): Promise<string> {
  const { apiKey, temperature = 0.2, maxNewTokens = 300 } = options;
  const modelCandidates = Array.from(new Set([getModel(), ...FALLBACK_MODELS]));
  const NON_RETRYABLE_ERROR_PREFIX = "HF_NON_RETRYABLE:";

  let lastError: Error | null = null;
  for (const model of modelCandidates) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(ROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxNewTokens,
          }),
        });

        const text = await response.text();
        let data: unknown;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }

        if (!response.ok) {
          const modelUnsupported =
            response.status === 400 &&
            (text.includes("model_not_supported") || text.includes("not supported by any provider"));

          if (modelUnsupported) {
            lastError = new Error(`HF model unsupported: ${model}`);
            break;
          }

          // Fail fast for auth/bad-request style errors so route timeout does not mask them as high-load fallback.
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(
              `${NON_RETRYABLE_ERROR_PREFIX} HF API ${response.status}: ${text || response.statusText}`
            );
          }

          if (response.status === 503 && data && typeof data === "object" && "estimated_time" in data) {
            const waitSec = Math.min((data as { estimated_time?: number }).estimated_time || 20, 60);
            if (attempt < MAX_RETRIES - 1) {
              await new Promise((r) => setTimeout(r, waitSec * 1000));
              continue;
            }
          }
          throw new Error(`HF API ${response.status}: ${text || response.statusText}`);
        }

        const content = (data as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content;
        if (content != null) return String(content).trim();
        throw new Error(`Unexpected HF response: ${text?.slice(0, 200)}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (lastError.message.startsWith(NON_RETRYABLE_ERROR_PREFIX)) {
          lastError = new Error(lastError.message.replace(`${NON_RETRYABLE_ERROR_PREFIX} `, ""));
          break;
        }
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }
  }
  throw lastError || new Error("Hugging Face API failed");
}

export async function rankProductsWithHF(input: {
  currentProduct: ProductRankingCandidate;
  candidates: ProductRankingCandidate[];
  limit?: number;
}): Promise<ProductRankingResult[]> {
  const apiKey =
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HUGGINGFACE_TOKEN ||
    process.env.HF_TOKEN ||
    "";

  if (!apiKey) return [];

  const limit = Math.max(1, Math.min(Number(input.limit || 4), 8));
  const candidates = input.candidates.slice(0, 30);
  const allowedHandles = new Set(candidates.map((candidate) => candidate.handle));

  const completion = await chatWithHF(
    [
      {
        role: "system",
        content: "You are a recommendation ranker for an e-commerce plant store. Return strict JSON only.",
      },
      {
        role: "user",
        content: `Store: SucculentSphere
Current Product:
${JSON.stringify({
  title: input.currentProduct.title,
  description: input.currentProduct.description,
  tags: input.currentProduct.tags,
  category: input.currentProduct.category,
  careLevel: input.currentProduct.careLevel,
  indoorOutdoor: input.currentProduct.indoorOutdoor,
  price: input.currentProduct.price,
})}

Filtered Candidates:
${JSON.stringify(
  candidates.map((candidate) => ({
    handle: candidate.handle,
    title: candidate.title,
    description: candidate.description,
    tags: candidate.tags,
    category: candidate.category,
    careLevel: candidate.careLevel,
    indoorOutdoor: candidate.indoorOutdoor,
    price: candidate.price,
    available: candidate.available,
  }))
)}

Return JSON only:
{
  "recommendations": [
    { "handle": "product-handle", "score": 0-100, "reason": "why recommended" }
  ]
}

Rules:
- Return exactly ${limit} products.
- Use only handles provided in filtered candidates.
- Prefer same care level, same category, tag overlap, and close price range.
- Prefer in-stock products.`,
      },
    ],
    { apiKey, temperature: 0.1, maxNewTokens: 700 }
  );

  const jsonBlock = extractJsonObject(completion);
  if (!jsonBlock) return [];

  try {
    const parsed = JSON.parse(jsonBlock) as { recommendations?: unknown };
    return sanitizeRanked(parsed?.recommendations, allowedHandles, limit);
  } catch {
    return [];
  }
}
