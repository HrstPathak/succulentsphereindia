import { chatWithHF } from "./huggingface";

type GenericMessage = { role: string; content: string };

interface ChatOptions {
  temperature?: number;
  maxNewTokens?: number;
  /**
   * Per-call timeout override in ms. When set it beats the provider defaults
   * (25s OpenRouter / 10s HF & Ollama) — used by the blog generator, whose
   * 4000-token generations need minutes, not seconds.
   */
  timeoutMs?: number;
  /**
   * Explicit provider order for THIS call. When set, only these providers are
   * tried, in exactly this order — the global LLM_PROVIDER_ORDER is ignored.
   * Used by the blog automation chain to pin the "gemini only" primary attempt
   * and the "openrouter only" fallback slots instead of relying on shared env.
   */
  providerOrder?: ProviderId[];
}

type ProviderId = "gemini" | "hf" | "openrouter" | "ollama";

interface Provider {
  id: ProviderId;
  run: (messages: GenericMessage[], options: ChatOptions) => Promise<string>;
}

// Gemini first: the free-tier Google provider is the PRIMARY for every caller
// (blog automation + chatbot); OpenRouter / HF / Ollama remain the fallbacks.
const DEFAULT_PROVIDER_ORDER: ProviderId[] = ["gemini", "ollama", "openrouter", "hf"];
const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000;
const GEMINI_PROVIDER_TIMEOUT_MS = 25_000;
const OPENROUTER_PROVIDER_TIMEOUT_MS = 25_000;

function getProviderTimeoutMs(providerId: ProviderId): number {
  const base =
    Number.parseInt(process.env.LLM_PROVIDER_TIMEOUT_MS || String(DEFAULT_PROVIDER_TIMEOUT_MS), 10) ||
    DEFAULT_PROVIDER_TIMEOUT_MS;

  if (providerId === "gemini") {
    const geminiTimeout =
      Number.parseInt(
        process.env.GEMINI_PROVIDER_TIMEOUT_MS || String(GEMINI_PROVIDER_TIMEOUT_MS),
        10
      ) || GEMINI_PROVIDER_TIMEOUT_MS;
    return Math.max(2_000, geminiTimeout);
  }

  if (providerId === "openrouter") {
    const openrouterTimeout =
      Number.parseInt(
        process.env.OPENROUTER_PROVIDER_TIMEOUT_MS || String(OPENROUTER_PROVIDER_TIMEOUT_MS),
        10
      ) || OPENROUTER_PROVIDER_TIMEOUT_MS;
    return Math.max(2_000, openrouterTimeout);
  }

  if (providerId === "ollama") {
    const ollamaTimeout = Number.parseInt(process.env.OLLAMA_PROVIDER_TIMEOUT_MS || String(base), 10) || base;
    return Math.max(2_000, ollamaTimeout);
  }

  if (providerId === "hf") {
    const hfTimeout = Number.parseInt(process.env.HF_PROVIDER_TIMEOUT_MS || String(base), 10) || base;
    return Math.max(2_000, hfTimeout);
  }

  return Math.max(2_000, base);
}

function getProviderOrder(): ProviderId[] {
  const raw = (process.env.LLM_PROVIDER_ORDER || "").trim();
  if (!raw) return DEFAULT_PROVIDER_ORDER;
  const parsed = raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v): v is ProviderId => ["gemini", "hf", "openrouter", "ollama"].includes(v));
  return parsed.length > 0 ? Array.from(new Set(parsed)) : DEFAULT_PROVIDER_ORDER;
}

function normalizeMessages(messages: GenericMessage[]) {
  return messages.map((m) => ({
    role: m.role === "system" || m.role === "assistant" ? m.role : "user",
    content: String(m.content || ""),
  }));
}

async function chatWithOpenAICompatible(input: {
  provider: Exclude<ProviderId, "hf" | "ollama">;
  apiKey: string;
  endpoint: string;
  model: string;
  messages: GenericMessage[];
  temperature?: number;
  maxNewTokens?: number;
}): Promise<string> {
  const {
    provider,
    apiKey,
    endpoint,
    model,
    messages,
    temperature = 0.2,
    maxNewTokens = 300,
  } = input;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (provider === "openrouter") {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
    headers["X-Title"] = process.env.OPENROUTER_SITE_NAME || "SucculentSphere";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: normalizeMessages(messages),
      temperature,
      max_tokens: maxNewTokens,
    }),
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    // Log the failing provider/model/status/body BEFORE the fallback chain moves
    // on — otherwise a swallowed provider error is impossible to diagnose in
    // Vercel's logs (e.g. blog-automation's silent OpenRouter 4xx/5xx).
    console.error(
      `${provider.toUpperCase()} failed for model "${model}"`,
      response.status,
      text
    );
    throw new Error(`${provider.toUpperCase()} API ${response.status}: ${text || response.statusText}`);
  }

  const choice = (
    data as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    }
  )?.choices?.[0];
  const content = choice?.message?.content;
  if (content != null) {
    // finish_reason=length means the model hit max_tokens mid-output — for the
    // blog pipeline that almost always truncates the JSON payload (which then
    // fails validation). Surface it loudly so the token budget is tunable.
    if (choice?.finish_reason === "length") {
      console.warn(
        `${provider.toUpperCase()} response for model "${model}" was truncated (finish_reason=length) — output likely incomplete; raise BLOG_MAX_NEW_TOKENS or pick a faster model`
      );
    }
    return String(content).trim();
  }
  throw new Error(`${provider.toUpperCase()} API malformed response`);
}

function getProviders(): Provider[] {
  const providers: Provider[] = [];

  // PRIMARY provider: Google Gemini via its OpenAI-compatible endpoint — the
  // request body (model/messages/temperature/max_tokens) and the response
  // shape (choices[0].message.content) are exactly what
  // chatWithOpenAICompatible() already builds and parses.
  const geminiApiKey = process.env.GEMINI_API_KEY || "";
  if (geminiApiKey) {
    providers.push({
      id: "gemini",
      run: (messages, options) =>
        chatWithOpenAICompatible({
          provider: "gemini",
          apiKey: geminiApiKey,
          endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          model: process.env.GEMINI_MODEL || "gemini-flash-latest",
          messages,
          ...options,
        }),
    });
  }

  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || "";
  if (hfToken) {
    providers.push({
      id: "hf",
      run: (messages, options) => chatWithHF(messages, { apiKey: hfToken, ...options }),
    });
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
  if (openRouterApiKey) {
    providers.push({
      id: "openrouter",
      run: (messages, options) =>
        chatWithOpenAICompatible({
          provider: "openrouter",
          apiKey: openRouterApiKey,
          endpoint: "https://openrouter.ai/api/v1/chat/completions",
          model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
          messages,
          ...options,
        }),
    });
  }

  const ollamaModel = process.env.OLLAMA_MODEL || "";
  if (ollamaModel) {
    providers.push({
      id: "ollama",
      run: async (messages, options) => {
        const endpoint = `${process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"}/api/chat`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: ollamaModel,
            messages: normalizeMessages(messages),
            stream: false,
            options: {
              temperature: options.temperature ?? 0.2,
              num_predict: options.maxNewTokens ?? 300,
            },
          }),
        });
        const text = await response.text();
        let data: unknown = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }
        if (!response.ok) {
          throw new Error(`OLLAMA API ${response.status}: ${text || response.statusText}`);
        }
        const content = (data as { message?: { content?: string } })?.message?.content;
        if (content != null) return String(content).trim();
        throw new Error("OLLAMA API malformed response");
      },
    });
  }

  return providers;
}

export function hasLLMProviderConfigured(): boolean {
  return getProviders().length > 0;
}

export async function chatWithFailover(
  messages: GenericMessage[],
  options: ChatOptions = {}
): Promise<{ content: string; provider: ProviderId }> {
  const providers = getProviders();
  if (providers.length === 0) {
    throw new Error(
      "No LLM provider configured. Set one of: GEMINI_API_KEY, OPENROUTER_API_KEY, HF_TOKEN, OLLAMA_MODEL."
    );
  }

  // An explicit providerOrder pins BOTH the pool (only these providers) and
  // the sequence — used by the blog automation chain for its "gemini only"
  // primary attempt and its "openrouter only" fallback slots.
  const requestedOrder = options.providerOrder;
  const pool = requestedOrder
    ? providers.filter((provider) => requestedOrder.includes(provider.id))
    : providers;
  if (pool.length === 0) {
    throw new Error(
      `No LLM provider configured for requested order [${requestedOrder?.join(", ")}]. ` +
        "Set the matching env: GEMINI_API_KEY / OPENROUTER_API_KEY / HF_TOKEN / OLLAMA_MODEL."
    );
  }
  const order = requestedOrder ?? getProviderOrder();
  const sorted = pool.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const errors: string[] = [];

  for (const provider of sorted) {
    const providerTimeoutMs = options.timeoutMs ?? getProviderTimeoutMs(provider.id);
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const content = await Promise.race<string>([
        provider.run(messages, options),
        new Promise<string>((_, reject) => {
          timeoutTimer = setTimeout(
            () =>
              reject(
                new Error(
                  `${provider.id.toUpperCase()} provider timeout after ${Math.round(providerTimeoutMs / 1000)}s`
                )
              ),
            providerTimeoutMs
          );
        }),
      ]);
      return { content, provider: provider.id };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${provider.id}: ${msg}`);
    } finally {
      // Always stop the race timer — a pending setTimeout keeps a serverless
      // function alive (and billed) even after a fast success.
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }
  }

  throw new Error(`All LLM providers failed. ${errors.join(" | ")}`);
}
