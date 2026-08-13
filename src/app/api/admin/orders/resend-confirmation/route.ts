import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { sendOrderConfirmationEmail } from "@/lib/order-email";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "order id required" }, { status: 400 });
    const db = getFirebaseDb();
    const doc = await db.collection("orders").doc(String(id)).get();
    if (!doc.exists) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const data: any = doc.data() || {};
    const orderEmail = {
      orderId: doc.id,
      orderNumber: Number(data.orderNumber || 0),
      customerName: (data.customer?.fullName) || (data.customer?.name) || "Customer",
      customerEmail: data.customer?.email || data.emailLower || "",
      items: (data.lineItems || []).map((li: any) => ({ title: li.title, quantity: li.quantity, price: li.price?.amount || li.price, image: li.image, imageAlt: li.imageAlt })),
      total: Number(data.totalPrice?.amount || data.total || 0),
      paymentMode: data.paymentMode || "prepaid",
      address: data.customer?.address1 || data.customer?.address || "",
      city: data.customer?.city || data.customer?.province || "",
      state: data.customer?.state || data.customer?.province || "",
      pincode: data.customer?.zip || data.customer?.pincode || "",
      phone: data.customer?.phone || "",
      shipping: Number(data.shipping || 0),
      discount: Number(data.discount || 0),
      codFee: Number(data.codFee || 0),
      paymentReceived: Number(data.paymentReceived || data.razorpayAmount || data.currentTotalPrice?.amount || 0),
    };

    const result = await sendOrderConfirmationEmail(orderEmail as any);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ error: String((error as Error).message || error) }, { status: 500 });
  }
}
