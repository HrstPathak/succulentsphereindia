import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { generateBlogWithFallback } from "@/lib/automation/generate-with-fallback";
import { parseGeneratedArticle } from "@/lib/automation/article-parser";
import { buildBlogPrompt } from "@/lib/automation/blog-prompt-template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Ceiling for ONE automation run (1 Gemini primary attempt + up to 6 OpenRouter
// fallback slots, each with its own ~120s budget — the theoretical worst case
// 7 × 120s far exceeds this, so prod cuts pathological runs at 5 min; in
// practice Gemini answers on attempt 1 and the run finishes in ~1-2 min).
// If your Vercel plan rejects 300 on deploy (classic Hobby caps at 60), lower
// this value accordingly.
export const maxDuration = 300;

const TOPIC_SCAN_LIMIT = 50;
const MAX_HANDLE_ATTEMPTS = 1000;

function slugify(input: string) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
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
    // Returns an already-validated article — unparseable model output is
    // treated as a failed attempt inside the fallback chain itself.
    const { article, modelUsed } = await generateBlogWithFallback(prompt);

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
    // Log the final thrown error before returning the 500 so the root cause is
    // visible in Vercel's runtime logs, not just in the HTTP response body.
    console.error("[blog-automation] cron route failed:", error);
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