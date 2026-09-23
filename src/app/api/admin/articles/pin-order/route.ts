import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { MAX_PINNED_ARTICLES } from "@/lib/article-pinning";
import { writePinnedOrder } from "@/lib/article-pin-store";

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

function authStatus(error: unknown): number {
  return String((error as Error).message) === AUTH_ERROR ? 404 : 500;
}

function authMessage(error: unknown, fallback: string): string {
  return String((error as Error).message) === AUTH_ERROR
    ? "Not found."
    : String((error as Error).message || error) || fallback;
}

/**
 * Persist the home page order of pinned blogs.
 *
 * PATCH body: { ids: string[] } — every pinned blog id, top of the rail first.
 * Multiple blogs can be pinned at the same time (up to MAX_PINNED_ARTICLES);
 * this endpoint only rewrites their `pinnedOrder` so the order the admin
 * arranged is exactly what visitors see.
 */
export async function PATCH(request: Request) {
  try {
    await requireAdmin()
    const body = await request.json()
    if (!Array.isArray(body.ids)) {
      return NextResponse.json({ error: "ids must be an array of article ids" }, { status: 400 })
    }

    const rawIds: unknown[] = Array.isArray(body.ids) ? (body.ids as unknown[]) : []
    const ids: string[] = Array.from(
      new Set(rawIds.map((value) => String(value ?? "").trim()).filter((value) => value.length > 0)),
    )
    if (!ids.length) return NextResponse.json({ error: "No pinned articles to order" }, { status: 400 })
    if (ids.length > MAX_PINNED_ARTICLES) {
      return NextResponse.json(
        { error: `You can pin up to ${MAX_PINNED_ARTICLES} blogs to the home page.` },
        { status: 400 },
      )
    }

    const db = getFirebaseDb()
    const docs = await db.getAll(...ids.map((id) => db.collection("articles").doc(id)))
    if (docs.some((doc) => !doc.exists)) {
      return NextResponse.json({ error: "One of the pinned articles no longer exists" }, { status: 404 })
    }

    await writePinnedOrder(db, ids)
    revalidateBlogPages()
    return NextResponse.json({ ok: true, ids })
  } catch (error) {
    return NextResponse.json({ error: authMessage(error, "Unable to update the pin order.") }, { status: authStatus(error) })
  }
}
