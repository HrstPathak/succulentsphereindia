import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { sendOrderConfirmationEmail } from "@/lib/order-email";

const text = (value: unknown) => String(value || "").trim();
const email = (value: unknown) => text(value).toLowerCase();

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const customer =
      body.customer && typeof body.customer === "object"
        ? (body.customer as Record<string, unknown>)
        : {};
    const customerEmail = email(customer.email);
    const customerName = text(customer.fullName) || "Test customer";
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items = rawItems
      .map((item) => ({
        productId: text(item?.productId),
        quantity: Math.max(
          1,
          Math.min(25, Math.floor(Number(item?.quantity || 1))) || 1,
        ),
      }))
      .filter((item) => item.productId)
      .slice(0, 25);
    if (!/^\S+@\S+\.\S+$/.test(customerEmail) || !items.length)
      return NextResponse.json(
        { error: "Enter a recipient email and select at least one product." },
        { status: 400 },
      );

    const db = getFirebaseDb();
    const matchingCustomer = await db
      .collection("users")
      .where("email", "==", customerEmail)
      .limit(1)
      .get();
    const customerUid = matchingCustomer.docs[0]?.id || null;
    const result: {
      orderId: string;
      orderNumber: number;
      items: { title: string; quantity: number; price: string }[];
      total: number;
    } = await db.runTransaction(async (tx) => {
      const refs = items.map((item) =>
        db.collection("products").doc(item.productId),
      );
      const products = await Promise.all(refs.map((ref) => tx.get(ref)));
      products.forEach((product, index) => {
        const available = Math.max(
          0,
          Number(product.get("inventoryQuantity") ?? 0),
        );
        if (
          !product.exists ||
          product.get("available") === false ||
          available < items[index]!.quantity
        )
          throw new Error(`Insufficient stock for item ${index + 1}.`);
      });
      const counterRef = db.collection("system").doc("counters");
      const counter = await tx.get(counterRef);
      const orderNumber = Number(counter.get("orderNumber") || 1000) + 1;
      const orderRef = db.collection("orders").doc();
      const lineItems = products.map((product, index) => {
        const data = product.data() || {};
        const quantity = items[index]!.quantity;
        const price = Number(data.price || 0);
        return {
          id: product.id,
          productId: product.id,
          productHandle: text(data.handle),
          title: text(data.title) || "Product",
          quantity,
          image: text(data.image),
          imageAlt: text(data.imageAlt),
          price: { amount: String(price), currencyCode: "INR" },
          originalTotalPrice: {
            amount: String(price * quantity),
            currencyCode: "INR",
          },
          discountedTotalPrice: {
            amount: String(price * quantity),
            currencyCode: "INR",
          },
          customAttributes: [],
        };
      });
      const total = lineItems.reduce(
        (sum, item) => sum + Number(item.price.amount) * item.quantity,
        0,
      );
      const now = new Date().toISOString();
      tx.set(counterRef, { orderNumber }, { merge: true });
      tx.set(orderRef, {
        orderNumber,
        userId: customerUid,
        emailLower: customerEmail,
        customer: {
          fullName: customerName,
          email: customerEmail,
          phone: text(customer.phone),
          address1: text(customer.address1),
          address2: text(customer.address2),
          city: text(customer.city),
          province: text(customer.province),
          zip: text(customer.zip),
          country: text(customer.country) || "India",
        },
        lineItems,
        subtotal: total,
        shipping: 0,
        discount: 0,
        total,
        currency: "INR",
        totalPrice: { amount: String(total), currencyCode: "INR" },
        currentSubtotalPrice: { amount: String(total), currencyCode: "INR" },
        currentTotalShippingPrice: { amount: "0", currencyCode: "INR" },
        currentTotalPrice: { amount: String(total), currencyCode: "INR" },
        paymentMode: "admin_test",
        financialStatus: "TEST",
        paymentStatus: "test",
        fulfillmentStatus: "UNFULFILLED",
        processedAt: now,
        createdAt: now,
        updatedAt: now,
        tracking: [],
        emailStatus: "pending",
        testOrder: true,
        testCreatedBy: admin.email,
      });
      products.forEach((product, index) =>
        tx.update(product.ref, {
          inventoryQuantity: Math.max(
            0,
            Number(product.get("inventoryQuantity") || 0) -
              items[index]!.quantity,
          ),
          updatedAt: now,
        }),
      );
      return {
        orderId: orderRef.id,
        orderNumber,
        items: lineItems.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price.amount,
        })),
        total,
      };
    });
    await sendOrderConfirmationEmail({
      ...result,
      customerName,
      customerEmail,
      paymentMode: "admin_test",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Unable to create test order." },
      {
        status:
          String((error as Error).message) === "ADMIN_REQUIRED" ? 404 : 500,
      },
    );
  }
}
