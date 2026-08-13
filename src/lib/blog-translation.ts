import { chatWithFailover, hasLLMProviderConfigured } from "@/lib/llm";
import { sanitizeArticleHtml } from "@/lib/article-html";

export type SupportedLanguage = "en" | "hi";

export interface TranslationPayload {
  title: string;
  excerpt: string;
  contentHtml: string;
  targetLanguage: SupportedLanguage;
}

export interface TranslationResponse {
  title: string;
  excerpt: string;
  contentHtml: string;
}

const SUPPORTED_LANGUAGES: Record<SupportedLanguage, { name: string; nativeName: string }> = {
  en: { name: "English", nativeName: "English" },
  hi: { name: "Hindi", nativeName: "\u0939\u093f\u0902\u0926\u0940" },
};

const textTranslationCache = new Map<string, string>();

type HtmlToken =
  | { type: "tag"; value: string }
  | { type: "plain"; value: string }
  | { type: "segment"; leading: string; trailing: string; index: number };

function sanitizePlainText(value: unknown, maxLength: number): string {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function estimateMaxNewTokens(input: TranslationPayload): number {
  const size = input.title.length + input.excerpt.length + input.contentHtml.length;
  return Math.max(900, Math.min(2200, Math.ceil(size / 5)));
}

function tryParseJsonTranslation(value: string): TranslationResponse | null {
  try {
    const parsed = JSON.parse(value) as Partial<TranslationResponse>;
    if (!parsed || typeof parsed !== "object") return null;
    const title = sanitizePlainText(parsed.title, 220);
    const excerpt = sanitizePlainText(parsed.excerpt, 500);
    const contentHtml = sanitizeArticleHtml(String(parsed.contentHtml || ""));
    if (!title || !contentHtml) return null;
    return {
      title,
      excerpt: excerpt || title,
      contentHtml,
    };
  } catch {
    return null;
  }
}

function extractJsonTranslation(raw: string): TranslationResponse | null {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  const direct = tryParseJsonTranslation(cleaned);
  if (direct) return direct;

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return tryParseJsonTranslation(cleaned.slice(start, end + 1));
  }

  return null;
}

function splitHtmlIntoTokens(html: string): { tokens: HtmlToken[]; segments: string[] } {
  const parts = html.split(/(<[^>]+>)/g);
  const tokens: HtmlToken[] = [];
  const segments: string[] = [];

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("<") && part.endsWith(">")) {
      tokens.push({ type: "tag", value: part });
      continue;
    }

    if (!/\S/.test(part)) {
      tokens.push({ type: "plain", value: part });
      continue;
    }

    const leading = part.match(/^\s*/)?.[0] ?? "";
    const trailing = part.match(/\s*$/)?.[0] ?? "";
    const core = part.slice(leading.length, part.length - trailing.length);

    if (!core.trim()) {
      tokens.push({ type: "plain", value: part });
      continue;
    }

    const index = segments.length;
    segments.push(core);
    tokens.push({ type: "segment", leading, trailing, index });
  }

  return { tokens, segments };
}

function rebuildHtmlFromTokens(tokens: HtmlToken[], translatedSegments: string[]): string {
  return tokens
    .map((token) => {
      if (token.type === "tag" || token.type === "plain") return token.value;
      return `${token.leading}${translatedSegments[token.index] || ""}${token.trailing}`;
    })
    .join("");
}

function parseGoogleTranslateResponse(raw: string): string {
  const parsed = JSON.parse(raw) as unknown[];
  const first = Array.isArray(parsed) ? parsed[0] : null;
  if (!Array.isArray(first)) return "";

  return first
    .map((entry) => (Array.isArray(entry) ? String(entry[0] || "") : ""))
    .join("")
    .trim();
}

async function translateTextWithGoogle(text: string, targetLanguage: SupportedLanguage): Promise<string> {
  const normalized = normalizeText(text);
  if (!normalized || targetLanguage === "en") return text;

  const cacheKey = `${targetLanguage}:${normalized}`;
  const cached = textTranslationCache.get(cacheKey);
  if (cached) return cached;

  const sourceLanguage = targetLanguage === "hi" ? "en" : "auto";
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sourceLanguage);
  url.searchParams.set("tl", targetLanguage);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", normalized);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": "SucculentSphereBlogTranslator/1.0",
    },
    cache: "no-store",
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Google translation failed with status ${response.status}.`);
  }

  const translated = parseGoogleTranslateResponse(raw);
  if (!translated) {
    throw new Error("Google translation returned an empty response.");
  }

  textTranslationCache.set(cacheKey, translated);
  return translated;
}

async function translateHtmlWithGoogle(contentHtml: string, targetLanguage: SupportedLanguage): Promise<string> {
  const { tokens, segments } = splitHtmlIntoTokens(contentHtml);
  if (segments.length === 0) return contentHtml;

  const translatedSegments: string[] = [];
  for (const segment of segments) {
    translatedSegments.push(await translateTextWithGoogle(segment, targetLanguage));
  }

  return sanitizeArticleHtml(rebuildHtmlFromTokens(tokens, translatedSegments));
}

async function translateArticleWithLLM(payload: TranslationPayload): Promise<{ data: TranslationResponse; provider: string }> {
  const language = SUPPORTED_LANGUAGES[payload.targetLanguage];
  const { content, provider } = await chatWithFailover(
    [
      {
        role: "system",
        content: [
          "You translate Succulent Sphere blog articles.",
          `Translate the article into ${language.name} (${language.nativeName}).`,
          "Preserve the HTML structure exactly and translate only visible text.",
          "Do not add explanations, notes, or extra text.",
          'Return strict JSON only with keys "title", "excerpt", and "contentHtml".',
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          title: payload.title,
          excerpt: payload.excerpt,
          contentHtml: payload.contentHtml,
        }),
      },
    ],
    {
      temperature: 0.1,
      maxNewTokens: estimateMaxNewTokens(payload),
    }
  );

  const parsed = extractJsonTranslation(content);
  if (!parsed) {
    throw new Error("LLM translation returned unreadable JSON.");
  }

  return { data: parsed, provider };
}

async function translateArticleWithGoogle(payload: TranslationPayload): Promise<{ data: TranslationResponse; provider: string }> {
  const [title, excerpt, contentHtml] = await Promise.all([
    translateTextWithGoogle(payload.title, payload.targetLanguage),
    payload.excerpt ? translateTextWithGoogle(payload.excerpt, payload.targetLanguage) : Promise.resolve(payload.title),
    translateHtmlWithGoogle(payload.contentHtml, payload.targetLanguage),
  ]);

  return {
    provider: "google-translate-fallback",
    data: {
      title: sanitizePlainText(title, 220),
      excerpt: sanitizePlainText(excerpt, 500),
      contentHtml: sanitizeArticleHtml(contentHtml),
    },
  };
}

export function normalizeTranslationPayload(input: Partial<TranslationPayload>): TranslationPayload {
  const targetLanguage = input.targetLanguage === "hi" ? "hi" : "en";

  return {
    title: sanitizePlainText(input.title, 220),
    excerpt: sanitizePlainText(input.excerpt, 500),
    contentHtml: sanitizeArticleHtml(String(input.contentHtml || "").slice(0, 25_000)),
    targetLanguage,
  };
}

export async function translateBlogArticle(
  payload: TranslationPayload
): Promise<{ data: TranslationResponse; provider: string }> {
  if (payload.targetLanguage === "en") {
    return {
      provider: "original",
      data: {
        title: payload.title,
        excerpt: payload.excerpt || payload.title,
        contentHtml: payload.contentHtml,
      },
    };
  }

  if (hasLLMProviderConfigured()) {
    try {
      return await translateArticleWithLLM(payload);
    } catch {}
  }

  return translateArticleWithGoogle(payload);
}
