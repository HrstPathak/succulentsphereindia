import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * POST /api/admin/revalidate-blog
 *
 * Refreshes the cached /plant-care pages (ISR) after articles were changed
 * OUTSIDE the app — e.g. direct Firestore inserts from local scripts or the
 * Firebase console. Without this, the statically cached pages keep serving
 * the old content for up to `revalidate = 3600` seconds (1 hour).
 *
 * Call after direct DB writes:
 *   curl -X POST https://<your-domain>/api/admin/revalidate-blog \
 *        -H "Cookie: <your admin session cookie>"
 * (must be called while logged in as an admin in the same browser, or pass
 *  the admin session cookie explicitly)
 */
export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    revalidatePath("/plant-care");
    revalidatePath("/plant-care/[handle]", "page");
    return NextResponse.json({ ok: true, revalidated: ["/plant-care", "/plant-care/[handle]"] });
  } catch (error) {
    return NextResponse.json(
      { error: String((error as Error)?.message || "Revalidation failed") },
      { status: 500 },
    );
  }
}
