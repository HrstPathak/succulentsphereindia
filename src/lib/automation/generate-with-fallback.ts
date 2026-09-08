import { chatWithFailover } from "@/lib/llm";

/**
 * Blog-automation model fallback chain, isolated to this file on purpose —
 * the shared `chatWithFailover()` in src/lib/llm.ts is intentionally NOT
 * modified; this wrapper only controls *which model* gets requested per attempt.
 *
 * Model priority comes from AUTOMATION_MODEL_1 -> AUTOMATION_MODEL_2 ->
 * AUTOMATION_MODEL_3. Empty values are filtered out, so a partially configured
 * chain simply means fewer attempts. Leave _2/_3 unset until the model ID is
 * verified live on https://openrouter.ai/models — do not guess.
 */

export interface BlogGenerationResult {
  content: string;
  /** The model ID actually used (verified against the provider that answered). */
  modelUsed: string;
  provider: string;
}

const BLOG_TEMPERATURE = 0.6;
const BLOG_MAX_NEW_TOKENS = 4000;

function configuredAutomationModels(): string[] {
  return ["AUTOMATION_MODEL_1", "AUTOMATION_MODEL_2", "AUTOMATION_MODEL_3"]
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
  const candidates = configuredAutomationModels();

  // No explicit automation chain configured yet: behave exactly like the old
  // single call through the shared provider config (OPENROUTER_MODEL / HF_MODEL
  // / OLLAMA_MODEL) so nothing breaks before the admin pins models.
  if (candidates.length === 0) {
    const { content, provider } = await chatWithFailover(
      [{ role: "user", content: prompt }],
      { temperature: BLOG_TEMPERATURE, maxNewTokens: BLOG_MAX_NEW_TOKENS }
    );
    const modelUsed = String(
      process.env.OPENROUTER_MODEL || process.env.HF_MODEL || ""
    ).trim() || provider;
    return { content, modelUsed, provider };
  }

  const errors: string[] = [];
  for (const model of candidates) {
    try {
      const { content, provider } = await runWithModel(model, () =>
        chatWithFailover(
          [{ role: "user", content: prompt }],
          { temperature: BLOG_TEMPERATURE, maxNewTokens: BLOG_MAX_NEW_TOKENS }
        )
      );
      return { content, modelUsed: resolveUsedModel(model, provider), provider };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${model}: ${message}`);
    }
  }

  // Every configured model failed — the joined reasons become the topic's
  // failureReason via the route's existing catch handler.
  throw new Error(`All automation models failed. ${errors.join(" | ")}`);
}