import { chatWithFailover } from "@/lib/llm";
import {
  parseGeneratedArticle,
  type GeneratedArticle,
} from "@/lib/automation/article-parser";

/**
 * Blog-automation model fallback chain, isolated to this file on purpose —
 * this wrapper controls *which model* gets requested per attempt, plus a
 * longer per-attempt timeout suited to 4000-token generations (the shared
 * `chatWithFailover()` in src/lib/llm.ts only gained an opt-in `timeoutMs`
 * option; its defaults are unchanged for every other caller).
 *
 * Chain order:
 *   PRIMARY   — Google Gemini (GEMINI_API_KEY / GEMINI_MODEL, free tier),
 *               reached through the shared chatWithFailover() with
 *               providerOrder: ["gemini"] so ONLY Gemini is tried here.
 *               Transient failures (429 / 5xx / provider timeout / network)
 *               are retried with a short fixed delay BEFORE the run falls
 *               back to OpenRouter — the free tier's "high demand" 503s are
 *               temporary and usually clear within seconds, so retrying
 *               beats burning OpenRouter quota.
 *   FALLBACK  — AUTOMATION_MODEL_1 -> AUTOMATION_MODEL_2 -> ... ->
 *               AUTOMATION_MODEL_6 (see AUTOMATION_MODEL_SLOTS below — bump
 *               that constant to support more slots), pinned to OpenRouter via
 *               providerOrder: ["openrouter"]. Empty values are filtered out,
 *               so a partially configured chain simply means fewer attempts.
 *               Leave any slot unset until its model ID is verified live on
 *               https://openrouter.ai/models — do not guess.
 *
 * Every attempt (Gemini included) is validated in-loop by
 * parseGeneratedArticle(), so a prose refusal / truncated JSON advances the
 * chain exactly like an HTTP failure would.
 */

export interface BlogGenerationResult {
  /** Fully validated article — unparseable model output never leaves this module. */
  article: GeneratedArticle;
  /** The model ID actually used (verified against the provider that answered). */
  modelUsed: string;
  provider: string;
}

const BLOG_TEMPERATURE = 0.6;
const DEFAULT_BLOG_MAX_NEW_TOKENS = 4000;

/**
 * Output-token ceiling for ONE blog generation. If logs show
 * "finish_reason=length" (see src/lib/llm.ts), the model hit this ceiling
 * mid-output and the JSON payload was truncated — raise it via
 * BLOG_MAX_NEW_TOKENS (reasoning models can burn a big share of the budget
 * thinking before the JSON even starts).
 */
function blogMaxNewTokens(): number {
  return (
    Number.parseInt(process.env.BLOG_MAX_NEW_TOKENS || "", 10) ||
    DEFAULT_BLOG_MAX_NEW_TOKENS
  );
}

/**
 * Output-token ceiling for the GEMINI attempt specifically. Gemini 2.5 / 3.x
 * Flash "thinking" models spend reasoning tokens BEFORE the JSON even starts —
 * and those come out of max_tokens too — so reusing the OpenRouter slots'
 * 4000-token budget would truncate the JSON (finish_reason=length → parse
 * failure → pointless fallback). Tunable via GEMINI_BLOG_MAX_NEW_TOKENS.
 */
const DEFAULT_GEMINI_BLOG_MAX_NEW_TOKENS = 8192;

function geminiBlogMaxNewTokens(): number {
  return (
    Number.parseInt(process.env.GEMINI_BLOG_MAX_NEW_TOKENS || "", 10) ||
    DEFAULT_GEMINI_BLOG_MAX_NEW_TOKENS
  );
}

/**
 * Gemini is retried on TRANSIENT failures (429 / 5xx / provider timeout /
 * network) before the run falls back to OpenRouter. Live evidence this is
 * needed: the free tier answers real load spikes with
 * 503 "high demand ... Spikes in demand are usually temporary".
 * Deliberately a fixed short delay, NOT exponential backoff — serverless wall
 * clock is billed and the route already runs under Vercel's maxDuration.
 * Configurable via GEMINI_MAX_ATTEMPTS (1 disables retrying) and
 * GEMINI_RETRY_DELAY_MS. Permanent errors (401/403/404, malformed JSON,
 * refusals) are NOT retried — they advance to the OpenRouter chain directly.
 */
const DEFAULT_GEMINI_MAX_ATTEMPTS = 2;
const DEFAULT_GEMINI_RETRY_DELAY_MS = 10_000;

// Matches the message shapes thrown by src/lib/llm.ts, e.g.
// "GEMINI API 503: {...}", "GEMINI provider timeout after 120s", "fetch failed".
// Auth/config errors (401/403/404) deliberately do NOT match.
const GEMINI_TRANSIENT_ERROR_PATTERN =
  /\bAPI (429|500|502|503|504)\b|provider timeout|fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|network/i;

function geminiMaxAttempts(): number {
  const parsed = Number.parseInt(process.env.GEMINI_MAX_ATTEMPTS || "", 10);
  return parsed >= 1 ? parsed : DEFAULT_GEMINI_MAX_ATTEMPTS;
}

function geminiRetryDelayMs(): number {
  const parsed = Number.parseInt(process.env.GEMINI_RETRY_DELAY_MS || "", 10);
  return parsed >= 0 ? parsed : DEFAULT_GEMINI_RETRY_DELAY_MS;
}

/**
 * Gemini models tried in order on the PRIMARY stage (before OpenRouter).
 * #1 GEMINI_MODEL (default gemini-flash-latest) — best quality, but the
 * newest flash alias is also the most congestion-prone (live evidence:
 * 503 "high demand" / timeouts while stable models answer in ~3s).
 * #2 GEMINI_MODEL_FALLBACK (default gemini-flash-lite-latest) — a different,
 * usually-idle capacity pool. It gets a SINGLE attempt: the primary already
 * spent its retry budget, and the OpenRouter chain still stands behind this.
 */
function geminiModelCandidates(): string[] {
  const primary =
    String(process.env.GEMINI_MODEL || "").trim() || "gemini-flash-latest";
  const secondary =
    String(process.env.GEMINI_MODEL_FALLBACK || "").trim() ||
    "gemini-flash-lite-latest";
  return Array.from(new Set([primary, secondary]));
}

/**
 * Ceiling for ONE blog-generation attempt. Free-tier models streaming a full
 * 4000-token article routinely exceed the shared 25s OpenRouter default (an
 * "OPENROUTER provider timeout" killed real runs), so the blog chain gets its
 * own budget. Tunable without code changes via BLOG_PROVIDER_TIMEOUT_MS.
 * Worst case for the whole chain = configured slots × this value.
 */
const DEFAULT_BLOG_TIMEOUT_MS = 120_000;

function blogTimeoutMs(): number {
  return (
    Number.parseInt(process.env.BLOG_PROVIDER_TIMEOUT_MS || "", 10) ||
    DEFAULT_BLOG_TIMEOUT_MS
  );
}

/** Number of AUTOMATION_MODEL_N env slots tried in order — bump to add more. */
const AUTOMATION_MODEL_SLOTS = 6;

function configuredAutomationModels(): string[] {
  return Array.from(
    { length: AUTOMATION_MODEL_SLOTS },
    (_, i) => `AUTOMATION_MODEL_${i + 1}`
  )
    .map((name) => String(process.env[name] || "").trim())
    .filter(Boolean);
}

/**
 * chatWithFailover() reads OPENROUTER_MODEL from the environment on every call
 * (see getProviders() in llm.ts), so we can pin a candidate model per attempt
 * by temporarily overriding it and always restoring the previous value.
 */
async function runWithModel<T>(model: string, run: () => Promise<T>): Promise<T> {
  const previous = process.env.OPENROUTER_MODEL;
  process.env.OPENROUTER_MODEL = model;
  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env.OPENROUTER_MODEL;
    } else {
      process.env.OPENROUTER_MODEL = previous;
    }
  }
}

function resolveUsedModel(model: string, provider: string): string {
  // If the pinned OpenRouter model was actually the one that answered, report
  // it. When chatWithFailover fell over to Hugging Face / Ollama, report that
  // provider's own configured model instead of a misleading pinned ID.
  if (provider === "openrouter") return model;
  const providerModel = String(
    process.env.HF_MODEL || process.env.OLLAMA_MODEL || ""
  ).trim();
  return providerModel || provider;
}

export async function generateBlogWithFallback(
  prompt: string
): Promise<BlogGenerationResult> {
  const errors: string[] = [];

  // ── PRIMARY ATTEMPT: Google Gemini (free tier) ──────────────────────────
  // Every automation run hits Gemini first; only a failure here (429 / 5xx /
  // timeout / unparseable JSON) moves the run to the OpenRouter chain below.
  // Transient failures (429 / 5xx / timeout / network) are retried with a
  // short fixed delay BEFORE falling back — the free tier's "high demand"
  // 503s are temporary and usually clear within seconds.
  if (String(process.env.GEMINI_API_KEY || "").trim()) {
    const maxAttempts = geminiMaxAttempts();
    const retryDelayMs = geminiRetryDelayMs();
    const geminiCandidates = geminiModelCandidates();

    for (let candidateIndex = 0; candidateIndex < geminiCandidates.length; candidateIndex++) {
      const geminiModel = geminiCandidates[candidateIndex];
      // Primary model gets the full retry budget; the fallback Gemini model
      // gets a single attempt (fresh capacity pool, chain continues either way).
      const attemptsForModel = candidateIndex === 0 ? maxAttempts : 1;

      for (let attempt = 1; attempt <= attemptsForModel; attempt++) {
        try {
          const { content, provider } = await chatWithFailover(
            [{ role: "user", content: prompt }],
            {
              temperature: BLOG_TEMPERATURE,
              maxNewTokens: geminiBlogMaxNewTokens(),
              timeoutMs: blogTimeoutMs(),
              // Gemini ONLY on the primary stage — the OpenRouter slots below are
              // the explicit fallback, not an accidental second Gemini try.
              providerOrder: ["gemini"],
            }
          );
          const article = parseGeneratedArticle(content);
          console.log(
            `[blog-automation] Gemini "${geminiModel}" produced a valid article (${article.contentHtml.length} chars of HTML)` +
              (attempt > 1 ? ` — succeeded on retry ${attempt - 1}` : "")
          );
          return { article, modelUsed: geminiModel, provider };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const isTransient = GEMINI_TRANSIENT_ERROR_PATTERN.test(message);
          if (attempt < attemptsForModel && isTransient) {
            console.warn(
              `[blog-automation] Gemini "${geminiModel}" transient failure (attempt ${attempt}/${attemptsForModel}) — retrying in ${Math.round(retryDelayMs / 1000)}s:`,
              message
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            continue;
          }
          const nextStep =
            candidateIndex < geminiCandidates.length - 1
              ? " — trying the fallback Gemini model"
              : " — falling back to the OpenRouter chain";
          // Logged individually so each Gemini attempt's failure shows up in
          // Vercel's logs before the fallback chain starts.
          console.error(`[blog-automation] Gemini "${geminiModel}" failed${nextStep}:`, message);
          errors.push(`gemini(${geminiModel}): ${message}`);
          break;
        }
      }
    }
  }

  const candidates = configuredAutomationModels();

  // No explicit OpenRouter fallback chain configured: single call through the
  // shared provider config (OPENROUTER_MODEL / HF_MODEL / OLLAMA_MODEL).
  // Gemini was already attempted above when configured, so this call covers
  // the remaining providers only.
  if (candidates.length === 0) {
    const { content, provider } = await chatWithFailover(
      [{ role: "user", content: prompt }],
      {
        temperature: BLOG_TEMPERATURE,
        maxNewTokens: blogMaxNewTokens(),
        timeoutMs: blogTimeoutMs(),
        providerOrder: ["openrouter", "hf", "ollama"],
      }
    );
    // Single attempt, no chain to fall back to — an unparseable response still
    // fails the run, but with the parser's diagnosable message (raw preview).
    const article = parseGeneratedArticle(content);
    const modelUsed = String(
      process.env.OPENROUTER_MODEL || process.env.HF_MODEL || ""
    ).trim() || provider;
    return { article, modelUsed, provider };
  }


  for (const model of candidates) {
    try {
      const { content, provider } = await runWithModel(model, () =>
        chatWithFailover(
          [{ role: "user", content: prompt }],
          {
            temperature: BLOG_TEMPERATURE,
            maxNewTokens: blogMaxNewTokens(),
            timeoutMs: blogTimeoutMs(),
            // Pin each slot to OpenRouter so the Gemini-first global default
            // order can't hijack a slot attempt (slots pin OpenRouter model IDs).
            providerOrder: ["openrouter"],
          }
        )
      );
      // A model that answers with prose / a refusal / truncated output is a
      // FAILED attempt too — validate HERE so the chain moves on to the next
      // model, instead of the route dying after the loop "succeeded" with
      // unusable output (the old bug: junk from the last model killed the run
      // with "AI response did not contain a JSON object").
      const article = parseGeneratedArticle(content);
      console.log(
        `[blog-automation] model "${model}" produced a valid article (${article.contentHtml.length} chars of HTML)`
      );
      return { article, modelUsed: resolveUsedModel(model, provider), provider };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Log each model attempt individually so every failure in the chain shows
      // up in Vercel's logs — the route only surfaces the final summary error.
      // (The message already includes the HTTP status and response body thrown
      // by src/lib/llm.ts's chatWithOpenAICompatible.)
      console.error(
        `[blog-automation] automation model "${model}" failed:`,
        message
      );
      errors.push(`${model}: ${message}`);
    }
  }

  // Every configured model failed — the joined reasons become the topic's
  // failureReason via the route's existing catch handler.
  throw new Error(`All automation models failed. ${errors.join(" | ")}`);
}