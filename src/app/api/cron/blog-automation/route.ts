import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { generateBlogWithFallback } from "@/lib/automation/generate-with-fallback";
import { buildBlogPrompt } from "@/lib/automation/blog-prompt-template";
import { sanitizeArticleHtml } from "@/lib/article-html";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TOPIC_SCAN_LIMIT = 50;
const MAX_HANDLE_ATTEMPTS = 1000;

interface GeneratedArticle {
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

function slugify(input: string) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

// Same fence-strip + brace-slice extraction used by src/lib/blog-translation.ts.
function extractJsonObject(input: string): string | null {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return input.slice(start, end + 1);
}

function requireField(parsed: Record<string, unknown>, name: string): string {
  const value = String(parsed[name] || "").trim();
  if (!value) throw new Error(`Missing required field: ${name}`);
  return value;
}

function parseGeneratedArticle(raw: string): GeneratedArticle {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  const candidate = extractJsonObject(cleaned);
  if (!candidate) throw new Error("AI response did not contain a JSON object.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    throw new Error("AI response contained invalid JSON.");
  }

  const title = requireField(parsed, "title").slice(0, 60);
  const excerpt = String(parsed.excerpt || "").trim().slice(0, 160);
  const seoTitle = String(parsed.seoTitle || title).trim().slice(0, 60);
  const seoDescription = String(parsed.seoDescription || excerpt).trim().slice(0, 160);
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

// Unique handle without a composite Firestore index: range-query the base
// slug's collation bucket once, then append -2, -3, ... inside that set.
async function nextUniqueHandle(baseHandle: string): Promise<string> {
  const db = getFirebaseDb();
  const snapshot = await db
    .collection("articles")
    .where("handle", ">=", baseHandle)
    .where("handle", "<", `${baseHandle}\uf8ff`)
    .get();
  const used = new Set(snapshot.docs.map((doc) => String(doc.data().handle || "")));
  let handle = baseHandle;
  let attempt = 1;
  while (used.has(handle) && attempt < MAX_HANDLE_ATTEMPTS) {
    handle = `${baseHandle}-${attempt}`;
    attempt += 1;
  }
  if (used.has(handle)) throw new Error("Could not generate a unique article handle.");
  return handle;
}

async function runAutomation() {
  const db = getFirebaseDb();
  const snapshot = await db
    .collection("blogTopics")
    .where("status", "==", "pending")
    .limit(TOPIC_SCAN_LIMIT)
    .get();
  if (snapshot.empty) return { published: false, message: "No pending topics" };

  // Equality filter + in-memory sort (same pattern as src/lib/commerce.ts) —
  // avoids provisioning a composite index for status + createdAt.
  const oldest = snapshot.docs
    .slice()
    .sort((left, right) =>
      String(left.data().createdAt || "").localeCompare(String(right.data().createdAt || ""))
    )[0];
  const topicRef = oldest.ref;
  const topic = oldest.data();
  const topicLabel = String(topic.topic || "");

  try {
    const prompt = buildBlogPrompt(topicLabel, String(topic.notes || ""));
    const { content, modelUsed } = await generateBlogWithFallback(prompt);

    const article = parseGeneratedArticle(content);

    const baseHandle =
      slugify(article.title) || slugify(topicLabel) || `ai-post-${Date.now()}`;
    const handle = await nextUniqueHandle(baseHandle);

    const now = new Date().toISOString();
    const featuredImageUrl = String(topic.featuredImageUrl || "").trim();
    // The AI's suggested canonical path is validated, but the stored value must
    // match the final real URL (handle may carry a -2/-3 uniqueness suffix).
    const aiCanonical = String(article.canonicalPath || "").trim();
    const canonicalPath = /^\/[\w/\-]+$/.test(aiCanonical) ? aiCanonical : `/plant-care/${handle}`;
    const record = {
      title: article.title,
      handle,
      excerpt: article.excerpt,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      primaryKeyword: article.primaryKeyword,
      faqs: article.faqs,
      ogTitle: article.ogTitle,
      ogDescription: article.ogDescription,
      canonicalPath,
      authorName: "Succulent Sphere Team",
      contentHtml: article.contentHtml,
      status: "published",
      image: featuredImageUrl
        ? { url: featuredImageUrl, altText: article.title, width: 1600, height: 900 }
        : null,
      tags: article.tags,
      blogHandle: "plant-care",
      blogTitle: "Plant Care",
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const articleRef = await db.collection("articles").add(record);
    await topicRef.update({
      status: "published",
      publishedArticleId: articleRef.id,
      modelUsed,
      failureReason: null,
    });

    try {
      revalidatePath("/plant-care");
      revalidatePath("/plant-care/[handle]", "page");
    } catch {
      // revalidation is best-effort; the publish already succeeded
    }

    return { published: true, articleId: articleRef.id, handle, modelUsed };
  } catch (error) {
    const message = String((error as Error).message || error);
    try {
      await topicRef.update({
        status: "failed",
        failureReason: message.slice(0, 500),
      });
    } catch {
      // recording the failure is best-effort too
    }
    throw error;
  }
}

async function handleAutomation(req: Request) {
  try {
    // Dual-auth copied from src/app/api/shipments/process/route.ts: Vercel Cron
    // sends the Bearer secret; a logged-in admin (manual "Run now") passes the
    // session-cookie requireAdmin() path instead.
    const cronSecret = String(process.env.CRON_SECRET || "").trim();
    const authorization = String(req.headers.get("authorization") || "").trim();
    const calledByCron = Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
    if (!calledByCron) await requireAdmin();

    const result = await runAutomation();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String((error as Error).message || error) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleAutomation(req);
}

export async function POST(req: Request) {
  return handleAutomation(req);
}