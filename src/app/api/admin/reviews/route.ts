import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

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
    await getFirebaseDb()
      .collection("reviews")
      .doc(String(id))
      .set({ status, moderatedAt: new Date().toISOString() }, { merge: true });
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
    if (!(await db.collection("products").doc(safeProductId).get()).exists)
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
