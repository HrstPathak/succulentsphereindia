import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") || 50);
    const limit = Math.min(100, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 50));
    const cursor = String(url.searchParams.get("cursor") || "").trim();
    const collection = getFirebaseDb().collection("checkoutRecords");
    let query = collection.orderBy("createdAt", "desc").limit(limit + 1);

    if (cursor) {
      if (cursor.includes("/") || cursor.includes("\\")) {
        return NextResponse.json({ error: "Invalid pagination cursor." }, { status: 400 });
      }
      const cursorSnapshot = await collection.doc(cursor).get();
      if (!cursorSnapshot.exists) return NextResponse.json({ error: "Pagination cursor not found." }, { status: 400 });
      query = collection.orderBy("createdAt", "desc").startAfter(cursorSnapshot).limit(limit + 1);
    }

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > limit;
    const docs = snapshot.docs.slice(0, limit);
    const records = docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        checkoutId: String(data.checkoutId || doc.id),
        razorpayOrderId: String(data.razorpayOrderId || doc.id),
        receipt: String(data.receipt || ""),
        userId: String(data.userId || ""),
        customer: data.customer || {},
        items: Array.isArray(data.items) ? data.items : [],
        gathering: data.gathering || {},
        paymentMode: String(data.paymentMode || ""),
        paymentModeLabel: String(data.paymentModeLabel || ""),
        paymentStatus: String(data.paymentStatus || "pending"),
        checkoutStatus: String(data.checkoutStatus || "awaiting_payment"),
        paymentId: String(data.paymentId || ""),
        gatewayPaymentMethod: String(data.gatewayPaymentMethod || ""),
        paymentFailureReason: String(data.paymentFailureReason || ""),
        paymentAttempts: Array.isArray(data.paymentAttempts) ? data.paymentAttempts : [],
        currency: String(data.currency || "INR"),
        expectedAmountPaise: Number(data.expectedAmountPaise || 0),
        subtotal: Number(data.subtotal || 0),
        shipping: Number(data.shipping || 0),
        discount: Number(data.discount || 0),
        total: Number(data.total || 0),
        codFee: Number(data.codFee || 0),
        totalWithCod: Number(data.totalWithCod || 0),
        walletAmountApplied: Number(data.walletAmountApplied || 0),
        payableAmount: Number(data.payableAmount || 0),
        orderCreated: Boolean(data.orderCreated),
        firebaseOrderId: String(data.firebaseOrderId || ""),
        orderNumber: Number(data.orderNumber || 0),
        lastError: String(data.lastError || ""),
        createdAt: String(data.createdAt || ""),
        updatedAt: String(data.updatedAt || ""),
      };
    });

    return NextResponse.json({ records, nextCursor: hasMore ? docs.at(-1)?.id || null : null }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = String((error as Error).message || "Unable to load checkout records.");
    const status = message === "ADMIN_REQUIRED" ? 404 : message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to load checkout records." : "Not found." }, { status });
  }
}
