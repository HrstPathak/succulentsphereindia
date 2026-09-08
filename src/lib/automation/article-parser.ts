import { sanitizeArticleHtml } from "@/lib/article-html";

/**
 * Parses the raw LLM response for the blog-automation pipeline into the strict
 * GeneratedArticle shape. Kept in its own module so the model fallback chain
 * (generate-with-fallback.ts) can validate EVERY candidate response in-loop and
 * treat "model answered with prose / a refusal / truncated output" as a
 * per-model failure — instead of the route dying after a model "won" the chain
 * with unusable output.
 */

export interface GeneratedArticle {
  title: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  primaryKeyword: string;
  contentHtml: string;
  tags: string[];
  faqs: Array<{ question: string; answer: string }>;
  ogTitle: string;
  ogDescription: string;
  canonicalPath: string;
}

/** Short single-line preview of the raw response, for error messages + logs. */
function rawPreview(raw: string, max = 200): string {
  const flat = String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!flat) return "(empty response)";
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}

/** Reasoning models (e.g. nvidia/nemotron) emit <think>…</think> before the answer. */
function stripThinkBlocks(input: string): string {
  return String(input || "").replace(/<think>[\s\S]*?<\/think>/gi, "");
}

/**
 * Same fence-strip + brace-slice extraction used by src/lib/blog-translation.ts,
 * hardened for real-world model behaviour:
 * 1. <think>…</think> blocks are stripped first so their braces can't poison
 *    the first-{-to-last-} slice.
 * 2. Markdown fences around the JSON are removed before slicing.
 */
export function extractJsonObject(input: string): string | null {
  const cleaned = stripThinkBlocks(input)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function requireField(parsed: Record<string, unknown>, name: string): string {
  const value = String(parsed[name] || "").trim();
  if (!value) throw new Error(`Missing required field: ${name}`);
  return value;
}

export function parseGeneratedArticle(raw: string): GeneratedArticle {
  // Preview + extraction both operate on the think-stripped text — otherwise a
  // thinking-only response shows a confusing brace-filled preview.
  const stripped = stripThinkBlocks(raw);
  const candidate = extractJsonObject(stripped);
  if (!candidate) {
    throw new Error(
      `AI response did not contain a JSON object. Raw start: ${rawPreview(stripped)}`
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    throw new Error(
      `AI response contained invalid JSON (likely truncated — try a higher BLOG_MAX_NEW_TOKENS or a non-reasoning model). Raw start: ${rawPreview(stripped)}`
    );
  }

  const title = requireField(parsed, "title").slice(0, 60);
  const excerpt = String(parsed.excerpt || "")
    .trim()
    .slice(0, 160);
  const seoTitle = String(parsed.seoTitle || title)
    .trim()
    .slice(0, 60);
  const seoDescription = String(parsed.seoDescription || excerpt)
    .trim()
    .slice(0, 160);
  const primaryKeyword = requireField(parsed, "primaryKeyword").slice(0, 80);
  const ogTitle = requireField(parsed, "ogTitle").slice(0, 70);
  const ogDescription = requireField(parsed, "ogDescription").slice(0, 200);
  const canonicalPath = requireField(parsed, "canonicalPath");

  const contentHtml = sanitizeArticleHtml(String(parsed.contentHtml || ""));
  if (!contentHtml) throw new Error("Missing required field: contentHtml");
  // Defense-in-depth: this HTML lands on a live shared page, so residual
  // <style>/<script> blocks are a hard failure (inline styles only by contract).
  if (/<style[\s>]|<script[\s>]/i.test(contentHtml)) {
    throw new Error("AI output contains a <style> or <script> block — inline styles only.");
  }

  const rawTags = Array.isArray(parsed.tags)
    ? parsed.tags.map((value) => String(value).trim().toLowerCase())
    : [];
  const tags = Array.from(new Set(rawTags.filter(Boolean))).slice(0, 5);

  const rawFaqs = Array.isArray(parsed.faqs) ? parsed.faqs : null;
  if (!rawFaqs || rawFaqs.length !== 5) {
    throw new Error(
      `Missing required field: faqs (expected exactly 5 entries, got ${rawFaqs ? rawFaqs.length : 0})`
    );
  }
  const faqs = rawFaqs.map((entry, index) => {
    const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const question = String(record.question || "").trim();
    const answer = String(record.answer || "").trim();
    if (!question || !answer) {
      throw new Error(`Missing required field: faqs[${index}] (question and answer are required)`);
    }
    return { question: question.slice(0, 220), answer: answer.slice(0, 1200) };
  });

  return {
    title,
    excerpt,
    seoTitle,
    seoDescription,
    primaryKeyword,
    contentHtml,
    tags,
    faqs,
    ogTitle,
    ogDescription,
    canonicalPath,
  };
}