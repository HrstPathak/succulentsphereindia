import "server-only";
import crypto from "crypto";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { calculateOrderPricing, MIN_ORDER_AMOUNT } from "@/lib/pricing";
import { COD_DEPOSIT_AMOUNT, COD_FEE_AMOUNT, COD_ORDER_LIMIT } from "@/lib/checkoutConfig";
import type { OrderConfirmationEmail } from "@/lib/order-email";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import { enqueueShipment, processShipmentJob } from "@/lib/shipping";

export type CartItem = {
  id?: string;
  productId?: string;
  title?: string;
  price?: string;
  quantity?: number;
  handle?: string;
  variantId?: string;
  bundleId?: string;
  bundleTitle?: string;
  bundleDiscountRate?: number;
  isBundleHeader?: boolean;
  tags?: string[];
  itemCategory?: string;
  image?: string;
  imageAlt?: string;
};
export type CustomerInfo = {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};
export type GatheringInfo = {
  deliverySlot?: string;
  giftWrap?: boolean;
  notes?: string;
};
export type PaymentMode = "prepaid" | "cod_deposit";
export type CheckoutSession = {
  version: 2;
  razorpayOrderId: string;
  receipt: string;
  paymentMode: PaymentMode;
  expectedAmountPaise: number;
  currency: "INR";
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  codFee: number;
  totalWithCod: number;
  createdAt: string;
  updatedAt: string;
  status: string;
  paymentId?: string;
  paymentStatus?: string;
  firebaseOrderId?: string;
  orderNumber?: number;
  lastError?: string;
  items: CartItem[];
  customer: CustomerInfo;
  gathering: GatheringInfo;
  userId?: string | null;
};

const sessions = () => getFirebaseDb().collection("checkoutSessions");
const clean = (value: unknown) => String(value || "").trim();
const isFirestoreId = (value: string) => value.length > 0 && !value.includes("/") && !value.includes("\\");
const itemId = (item: CartItem) => clean(item.productId || item.id || item.variantId);

export function buildRazorpaySignature(orderId: string, paymentId: string, keySecret: string) {
  return crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function isValidRazorpaySignature(input: { orderId: string; paymentId: string; signature: string; keySecret: string }) {
  return crypto.timingSafeEqual(
    Buffer.from(buildRazorpaySignature(input.orderId, input.paymentId, input.keySecret)),
    Buffer.from(input.signature),
  );
}

export async function fetchRazorpayPayment(paymentId: string, keyId: string, keySecret: string) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.description || "Unable to verify payment status with Razorpay.");
  return data;
}

export async function priceCartItems(items: CartItem[]) {
  if (!Array.isArray(items) || !items.length) throw new Error("Cart is empty.");

  const db = getFirebaseDb();
  const out: CartItem[] = [];

  for (const item of items) {
    const requestedId = itemId(item);
    const handle = clean(item.handle);
    if (!requestedId && !handle) throw new Error("A cart item is missing its product id.");

    let doc = null;
    if (requestedId && isFirestoreId(requestedId)) {
      doc = await db.collection("products").doc(requestedId).get();
    }

    if ((!doc || !doc.exists) && handle) {
      const match = await db.collection("products").where("handle", "==", handle).limit(1).get();
      doc = match.empty ? null : match.docs[0]!;
    }

    if (!doc?.exists) {
      if (requestedId && !isFirestoreId(requestedId)) {
        throw new Error("A product in your cart has an invalid identifier. Please remove it and add it again.");
      }
      throw new Error("A product in your cart is no longer available. Please remove it and add it again.");
    }

    const product = doc.data() || {};
    const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
    const inventory = Number(product.inventoryQuantity ?? product.quantity ?? product.totalInventory ?? 0);
    if (product.available === false || inventory < quantity) throw new Error(`${clean(product.title) || "Product"} does not have enough stock.`);

    out.push({
      id: doc.id,
      productId: doc.id,
      title: clean(product.title),
      handle: clean(product.handle),
      price: Number(product.price || 0).toFixed(2),
      quantity,
      tags: Array.isArray(product.tags) ? product.tags.map(String) : [],
      itemCategory: clean(product.productType || product.type),
      image: clean(product.image),
      imageAlt: clean(product.imageAlt),
    });
  }

  return out;
}

export function getCheckoutAmounts(items: CartItem[], paymentMode: PaymentMode) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)), 0);
  if (subtotal < MIN_ORDER_AMOUNT) throw new Error(`Minimum order is INR ${MIN_ORDER_AMOUNT}.`);

  const pricing = calculateOrderPricing(subtotal, items);
  if (paymentMode === "cod_deposit" && pricing.total >= COD_ORDER_LIMIT) throw new Error(`Cash on Delivery is reserved for orders below INR ${COD_ORDER_LIMIT}.`);

  const codFee = paymentMode === "cod_deposit" ? COD_FEE_AMOUNT : 0;
  const totalWithCod = Number((pricing.total + codFee).toFixed(2));
  const payableAmount = paymentMode === "cod_deposit" ? COD_DEPOSIT_AMOUNT : totalWithCod;

  return {
    subtotal,
    pricing,
    codFee,
    totalWithCod,
    payableAmount,
    expectedAmountPaise: Math.round(payableAmount * 100),
  };
}

export function validateCheckoutPayload(input: { items: CartItem[]; customer: CustomerInfo; paymentMode: PaymentMode }) {
  const c = input.customer;
  if (
    !clean(c.fullName) ||
    !/^\S+@\S+\.\S+$/.test(clean(c.email)) ||
    !/^\+?\d{10,15}$/.test(clean(c.phone).replace(/[^\d+]/g, "")) ||
    !clean(c.address) ||
    !clean(c.city) ||
    !clean(c.state) ||
    !/^\d{6}$/.test(clean(c.pincode))
  ) {
    throw new Error("Please provide complete, valid delivery information.");
  }

  return getCheckoutAmounts(input.items, input.paymentMode);
}

export async function createCheckoutSession(input: Omit<CheckoutSession, "version" | "status" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const session: CheckoutSession = {
    ...input,
    version: 2,
    status: "created",
    createdAt: now,
    updatedAt: now,
  };

  await sessions().doc(session.razorpayOrderId).set(session);
  return session;
}

export async function getCheckoutSessionByOrderId(orderId: string) {
  const doc = await sessions().doc(orderId).get();
  return doc.exists ? (doc.data() as CheckoutSession) : null;
}

export async function getCheckoutSessionByPaymentId(paymentId: string) {
  const snapshot = await sessions().where("paymentId", "==", paymentId).limit(1).get();
  return snapshot.empty ? null : (snapshot.docs[0]!.data() as CheckoutSession);
}

export async function noteCheckoutSessionError(orderId: string, errorMessage: string) {
  await sessions().doc(orderId).set({ lastError: errorMessage, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function recordPaymentAgainstSession(input: { razorpayOrderId: string; paymentId: string; paymentStatus: string; amountPaise: number; currency: string }) {
  const session = await getCheckoutSessionByOrderId(input.razorpayOrderId);
  if (!session) throw new Error("Checkout session not found.");
  if (input.amountPaise !== session.expectedAmountPaise || input.currency !== session.currency) throw new Error("Payment amount does not match checkout session.");
  await sessions().doc(input.razorpayOrderId).set(
    {
      paymentId: input.paymentId,
      paymentStatus: input.paymentStatus,
      status: input.paymentStatus === "captured" ? "payment_captured" : "payment_authorized",
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export async function ensureFirebaseOrderForPayment(input: { razorpayOrderId: string; paymentId: string; paymentStatus: string; amountPaise: number; currency: string; waitForLockMs?: number }) {
  const db = getFirebaseDb();
  const sessionRef = sessions().doc(input.razorpayOrderId);
  let result: { firebaseOrderId?: string; orderNumber?: number; alreadyCreated: boolean; processing: boolean; email?: OrderConfirmationEmail } = {
    alreadyCreated: false,
    processing: false,
  };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) throw new Error("Checkout session not found.");

    const session = snap.data() as CheckoutSession;
    if (input.amountPaise !== session.expectedAmountPaise || input.currency !== session.currency) throw new Error("Payment amount does not match checkout session.");
    if (session.firebaseOrderId) {
      result = {
        firebaseOrderId: session.firebaseOrderId,
        orderNumber: session.orderNumber,
        alreadyCreated: true,
        processing: false,
      };
      return;
    }

    const productRefs = session.items.map((item) => {
      const id = itemId(item);
      if (!isFirestoreId(id)) {
        throw new Error("Order item has an invalid product reference. Please contact support.");
      }
      return db.collection("products").doc(id);
    });

    const products = await Promise.all(productRefs.map((ref) => tx.get(ref)));
    products.forEach((product, index) => {
      const available = Number(product.get("inventoryQuantity") ?? product.get("quantity") ?? product.get("totalInventory") ?? 0);
      if (!product.exists || product.get("available") === false || available < Number(session.items[index]?.quantity || 1)) {
        throw new Error("One or more items are now out of stock.");
      }
    });

    const counterRef = db.collection("system").doc("counters");
    const counter = await tx.get(counterRef);
    const orderNumber = Number(counter.get("orderNumber") || 1000) + 1;
    const orderRef = db.collection("orders").doc();

    const orderItems = session.items.map((item, index) => {
      const data = products[index]!.data() || {};
      return {
        id: itemId(item),
        productId: itemId(item),
        productHandle: clean(data.handle),
        title: clean(data.title),
        quantity: Number(item.quantity || 1),
        image: clean(data.image),
        imageAlt: clean(data.imageAlt),
        price: { amount: String(item.price), currencyCode: "INR" },
        originalTotalPrice: { amount: (Number(item.price) * Number(item.quantity || 1)).toFixed(2), currencyCode: "INR" },
        discountedTotalPrice: { amount: (Number(item.price) * Number(item.quantity || 1)).toFixed(2), currencyCode: "INR" },
        customAttributes: [],
      };
    });

    tx.set(counterRef, { orderNumber }, { merge: true });
    tx.set(orderRef, {
      orderNumber,
      userId: session.userId || null,
      emailLower: clean(session.customer.email).toLowerCase(),
      customer: session.customer,
      gathering: session.gathering,
      lineItems: orderItems,
      subtotal: session.subtotal,
      shipping: session.shipping,
      discount: session.discount,
      total: session.totalWithCod,
      currency: "INR",
      totalPrice: { amount: String(session.totalWithCod), currencyCode: "INR" },
      currentSubtotalPrice: { amount: String(session.subtotal), currencyCode: "INR" },
      currentTotalShippingPrice: { amount: String(session.shipping), currencyCode: "INR" },
      currentTotalPrice: { amount: String(session.totalWithCod), currencyCode: "INR" },
      paymentMode: session.paymentMode,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.paymentId,
      financialStatus: session.paymentMode === "cod_deposit" ? (input.paymentStatus === "captured" ? "DEPOSIT_PAID" : "PENDING") : (input.paymentStatus === "captured" ? "PAID" : "PENDING"),
      fulfillmentStatus: "UNFULFILLED",
      processedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      tracking: [],
      emailStatus: "pending",
    });

    productRefs.forEach((ref, index) =>
      tx.update(ref, {
        inventoryQuantity: Number(products[index]!.get("inventoryQuantity") ?? products[index]!.get("quantity") ?? 0) - Number(session.items[index]?.quantity || 1),
        updatedAt: new Date().toISOString(),
      }),
    );

    tx.set(
      sessionRef,
      {
        paymentId: input.paymentId,
        paymentStatus: input.paymentStatus,
        status: "order_created",
        firebaseOrderId: orderRef.id,
        orderNumber,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    result = {
      firebaseOrderId: orderRef.id,
      orderNumber,
      alreadyCreated: false,
      processing: false,
      email: {
        orderId: orderRef.id,
        orderNumber,
        customerName: clean(session.customer.fullName),
        customerEmail: clean(session.customer.email),
        items: orderItems.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price.amount,
          image: item.image,
          imageAlt: item.imageAlt,
        })),
        total: session.totalWithCod,
        paymentMode: session.paymentMode,
        address: session.customer.address,
        city: session.customer.city,
        state: session.customer.state,
        pincode: session.customer.pincode,
        phone: session.customer.phone,
        shipping: session.shipping,
        discount: session.discount,
        codFee: session.codFee,
        paymentReceived: Number(input.amountPaise) / 100,
      },
    };
  });

  // External calls must happen after the Firestore transaction has committed.
  // The order id is now durable, and enqueueShipment is idempotent per order.
  if (result.firebaseOrderId) {
    try {
      const jobId = await enqueueShipment(result.firebaseOrderId, { orderNumber: result.orderNumber });
      try {
        await processShipmentJob(jobId);
      } catch (error) {
        // The durable pending job is retried by /api/shipments/process.
        console.warn("Immediate shipment processing failed", String((error as Error).message || error));
      }
    } catch (error) {
      console.warn("Failed to enqueue shipment", String((error as Error).message || error));
    }
  }

  // After transaction completes, attempt to send the order confirmation email.
  // Return includes a flag so callers don't double-send.
  if (result.email) {
    try {
      await sendOrderConfirmationEmail(result.email);
      // annotate that email was sent so callers can avoid re-sending
      (result as any).emailSent = true;
    } catch (err) {
      // sendOrderConfirmationEmail already records failures to Firestore; swallow here
      (result as any).emailSent = false;
    }
  }

  return result;
}
