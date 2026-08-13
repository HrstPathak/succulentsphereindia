import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendOrderConfirmationEmail } from "@/lib/order-email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });

    const body = await req.json();
    const to = String(body?.to || "").trim();
    if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 });

    const now = Date.now();
    const fakeOrderId = `dev-test-${now}`;

    const testEmail = {
      orderId: fakeOrderId,
      orderNumber: Math.floor(10000 + (now % 90000)),
      customerName: "Test Customer",
      customerEmail: to,
      items: [
        { title: "Green Succulent", quantity: 1, price: "199", image: "https://via.placeholder.com/150", imageAlt: "Green Succulent" },
      ],
      total: 199,
      paymentMode: "prepaid" as const,
      address: "123 Test Lane",
      city: "Testville",
      state: "TS",
      pincode: "123456",
      phone: "+919800000000",
      shipping: 0,
      discount: 0,
      codFee: 0,
      paymentReceived: 199,
    };

    const result = await sendOrderConfirmationEmail(testEmail as any);
    return NextResponse.json({ ok: true, delivery: result });
  } catch (error) {
    return NextResponse.json({ error: String((error as Error)?.message || error) }, { status: 500 });
  }
}
