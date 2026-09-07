import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

const AUTH_ERROR = "ADMIN_REQUIRED";

/** Rebuild the public blog pages immediately after an admin change. */
function revalidateBlogPages() {
  try {
    revalidatePath("/plant-care");
    revalidatePath("/plant-care/[handle]", "page");
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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const doc = await getFirebaseDb().collection("articles").doc(id).get()
    if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ ok: true, article: { id: doc.id, ...doc.data() } })
  } catch (error) {
    return NextResponse.json({ error: authMessage(error, "Unable to load article.") }, { status: authStatus(error) })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const db = getFirebaseDb()
    const ref = db.collection("articles").doc(id)
    const existingDoc = await ref.get()
    if (!existingDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const existing = existingDoc.data() as Record<string, unknown>

    const body = await request.json()
    const now = new Date().toISOString()

    const nextHandle = body.handle ? slugify(String(body.handle)) : String(existing.handle || "")
    if (nextHandle !== existing.handle) {
      const clash = await db.collection("articles").where("handle", "==", nextHandle).limit(1).get()
      if (!clash.empty && clash.docs[0]!.id !== id) {

        return NextResponse.json({ error: `Handle "${nextHandle}" is already in use` }, { status: 409 })
      }
    }

    const nextStatus = body.status === "published" || body.status === "draft" ? body.status : String(existing.status || "published")
    const wasPublished = existing.status === "published"
    const willBePublished = nextStatus === "published"

    const update: Record<string, unknown> = {
      title: body.title !== undefined ? String(body.title) : existing.title,
      handle: nextHandle,
      excerpt: body.excerpt !== undefined ? String(body.excerpt) : existing.excerpt,
      seoTitle: body.seoTitle !== undefined ? String(body.seoTitle) : existing.seoTitle,
      seoDescription: body.seoDescription !== undefined ? String(body.seoDescription) : existing.seoDescription,
      authorName: body.authorName !== undefined ? String(body.authorName) : existing.authorName,
      contentHtml: body.contentHtml !== undefined ? String(body.contentHtml) : existing.contentHtml,
      status: nextStatus,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : existing.tags,
      updatedAt: now,
    }

    if (body.image !== undefined) {
      update.image = body.image && body.image.url ? {
        url: String(body.image.url),
        altText: String(body.image.altText || String(update.title)),
        width: Number(body.image.width) || 1600,
        height: Number(body.image.height) || 900,
      } : null
    }

    if (!wasPublished && willBePublished) {
      update.publishedAt = now
    }

    await ref.update(update);
    revalidateBlogPages();
    const updated = await ref.get();
    return NextResponse.json({ ok: true, article: { id: updated.id, ...updated.data() } })
  } catch (error) {
    return NextResponse.json({ error: authMessage(error, "Unable to save article.") }, { status: authStatus(error) })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    await getFirebaseDb().collection("articles").doc(id).delete();
    revalidateBlogPages();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: authMessage(error, "Unable to delete article.") }, { status: authStatus(error) })
  }
}