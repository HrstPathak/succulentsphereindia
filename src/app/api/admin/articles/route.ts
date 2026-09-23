import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { assertPinCapacity, PinLimitError, pinArticleToTop } from "@/lib/article-pin-store";

const AUTH_ERROR = "ADMIN_REQUIRED";

/** Rebuild the public blog pages immediately after an admin change. */
function revalidateBlogPages() {
  try {
    revalidatePath("/plant-care");
    revalidatePath("/plant-care/[handle]", "page");
    // Pinned articles also appear on the home page plant-care rail
    revalidatePath("/");
  } catch {
    // revalidation is best-effort; never fail the API call because of it
  }
}

function slugify(input: string) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function authStatus(error: unknown): number {
  return String((error as Error).message) === AUTH_ERROR ? 404 : 500;
}

function authMessage(error: unknown, fallback: string): string {
  return String((error as Error).message) === AUTH_ERROR
    ? "Not found."
    : String((error as Error).message || error) || fallback;
}

export async function GET() {
  try {
    await requireAdmin()
    const snapshot = await getFirebaseDb().collection("articles").orderBy("updatedAt", "desc").limit(200).get()
    const items = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        title: String(data.title || ""),
        handle: String(data.handle || ""),
        status: String(data.status || "published"),
        updatedAt: String(data.updatedAt || data.publishedAt || ""),
        pinned: data.pinned === true,
        pinnedOrder: data.pinnedOrder === null || data.pinnedOrder === undefined || !Number.isFinite(Number(data.pinnedOrder)) ? undefined : Number(data.pinnedOrder),
        pinnedAt: String(data.pinnedAt || ""),
        image: data.image || null,
      }
    })
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    return NextResponse.json({ error: authMessage(error, "Unable to load articles.") }, { status: authStatus(error) })
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()
    const title = String(body.title || "").trim()
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    const handle = slugify(body.handle || title)
    const db = getFirebaseDb()

    const existing = await db.collection("articles").where("handle", "==", handle).limit(1).get()
    if (!existing.empty) {
      return NextResponse.json({ error: `Handle "${handle}" is already in use` }, { status: 409 })
    }

    const now = new Date().toISOString()
    const status = body.status === "published" ? "published" : "draft"
    const wantsPin = body.pinned === true

    // Multiple blogs can be pinned at once, but only up to the rail capacity.
    if (wantsPin) await assertPinCapacity(db)

    const record = {
      title,
      handle,
      excerpt: String(body.excerpt || ""),
      seoTitle: String(body.seoTitle || title),
      seoDescription: String(body.seoDescription || body.excerpt || ""),
      authorName: String(body.authorName || "Succulent Sphere Team"),
      contentHtml: String(body.contentHtml || ""),
      status,
      image: body.image && body.image.url ? {
        url: String(body.image.url),
        altText: String(body.image.altText || title),
        width: Number(body.image.width) || 1600,
        height: Number(body.image.height) || 900,
      } : null,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      blogHandle: "plant-care",
      blogTitle: "Plant Care",
      publishedAt: status === "published" ? now : "",
      createdAt: now,
      updatedAt: now,
      pinned: wantsPin,
      pinnedAt: wantsPin ? now : null,
      pinnedOrder: null,
    }

    const docRef = await db.collection("articles").add(record)

    // A freshly pinned blog takes the first slot of the home page rail; the
    // other pinned blogs keep their relative order underneath it.
    if (record.pinned) await pinArticleToTop(db, docRef.id)

    revalidateBlogPages()
    const created = await docRef.get()
    return NextResponse.json({ ok: true, article: { id: created.id, ...created.data() } })
  } catch (error) {
    if (error instanceof PinLimitError) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ error: authMessage(error, "Unable to create article.") }, { status: authStatus(error) })
  }
}