import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { invalidateAdminScopes } from "@/lib/admin-cache";
import { invalidateProductCaches } from "@/lib/cache-invalidation";

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const { id, status } = await request.json();
    if (
      !String(id || "").trim() ||
      !["published", "hidden"].includes(String(status || ""))
    )
      return NextResponse.json(
        { error: "Valid review and status are required." },
        { status: 400 },
      );
    // Read the product id BEFORE the write. Moderation is the case that most
    // needs a correct invalidation: hiding a review must remove it from the
    // storefront immediately, and the request body only carries the review id.
    const ref = getFirebaseDb().collection("reviews").doc(String(id));
    const existing = await ref.get();
    const productId = String(existing.get("productId") || "").trim();
    await ref.set({ status, moderatedAt: new Date().toISOString() }, { merge: true });
    // Hiding a review removes it from the storefront immediately, so the
    // Reviews tab must not keep serving the pre-moderation row.
    invalidateAdminScopes("reviews");
    const productDoc = productId ? await getFirebaseDb().collection("products").doc(productId).get() : null;
    const handle = productDoc && productDoc.exists ? String(productDoc.get("handle") || "").trim() : "";
    await invalidateProductCaches({ ids: productId ? [productId] : [], handles: handle ? [handle] : [], scope: "reviews" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          String((error as Error).message) === "ADMIN_REQUIRED"
            ? "Not found."
            : (error as Error).message,
      },
      {
        status:
          String((error as Error).message) === "ADMIN_REQUIRED" ? 404 : 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const {
      productId,
      authorName,
      authorEmail,
      title,
      content,
      rating,
      status,
      verifiedPurchase,
    } = await request.json();
    const safeProductId = String(productId || "").trim();
    const safeContent = String(content || "")
      .trim()
      .slice(0, 2000);
    const safeRating = Math.max(
      1,
      Math.min(5, Math.round(Number(rating || 0))),
    );
    const safeStatus = ["published", "hidden"].includes(String(status || ""))
      ? String(status)
      : "published";
    if (!safeProductId || !safeContent || !safeRating)
      return NextResponse.json(
        { error: "Product, rating, and review text are required." },
        { status: 400 },
      );
    const db = getFirebaseDb();
    const productDoc = await db.collection("products").doc(safeProductId).get();
    if (!productDoc.exists)
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 },
      );
    const ref = await db.collection("reviews").add({
      productId: safeProductId,
      authorName:
        String(authorName || "Store team")
          .trim()
          .slice(0, 120) || "Store team",
      ...(String(authorEmail || "").trim()
        ? {
            authorEmail: String(authorEmail).trim().toLowerCase().slice(0, 254),
          }
        : {}),
      title: String(title || "")
        .trim()
        .slice(0, 120),
      content: safeContent,
      rating: safeRating,
      status: safeStatus,
      verifiedPurchase: Boolean(verifiedPurchase),
      createdAt: new Date().toISOString(),
      createdByAdmin: true,
    });
    await ref.update({ id: ref.id });
    invalidateAdminScopes("reviews");
    const handle = String(productDoc.get("handle") || "").trim();
    await invalidateProductCaches({ ids: [safeProductId], handles: handle ? [handle] : [], scope: "reviews" });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          String((error as Error).message) === "ADMIN_REQUIRED"
            ? "Not found."
            : (error as Error).message,
      },
      {
        status:
          String((error as Error).message) === "ADMIN_REQUIRED" ? 404 : 500,
      },
    );
  }
}
