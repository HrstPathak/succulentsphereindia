import "server-only";

import { getFirebaseDb } from "@/lib/firebase-admin";
import { configuredEmailProvider, sendEmail } from "@/lib/email-sender";
import { buildDelhiveryTrackingUrl } from "@/lib/delhiveryTracking";

type OrderEmailItem = { title?: string; quantity?: number; price?: string; image?: string; imageAlt?: string };

export type OrderConfirmationEmail = {
  orderId: string;
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  items: OrderEmailItem[];
  total: number;
  paymentMode: "prepaid" | "cod_deposit" | "cod" | "admin_test";
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  shipping?: number;
  discount?: number;
  codFee?: number;
  paymentReceived?: number;
  codDepositAmount?: number;
  codBalance?: number;
  walletAmountUsed?: number;
  cashbackEarned?: number;
  payableAmount?: number;
};

function escapeHtml(value: unknown) {
  return String(value || "").replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      } as Record<string, string>)[character] || character,
  );
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function isCodEmailMode(value: string) {
  return value === "cod_deposit" || value === "cod";
}

function emailHtml(order: OrderConfirmationEmail) {
  const items = order.items
    .map((item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #edf0ed">
          <table cellspacing="0" cellpadding="0">
            <tr>
              ${item.image ? `<td style="padding-right:12px"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt || item.title || "Plant")}" width="64" height="64" style="display:block;border-radius:10px;object-fit:cover" /></td>` : ""}
              <td style="vertical-align:middle">
                <strong style="display:block;color:#113323">${escapeHtml(item.title || "Plant")}</strong>
                <span style="font-size:12px;color:#5d6f63">Quantity: ${Math.max(1, Number(item.quantity || 1))}</span>
              </td>
            </tr>
          </table>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #edf0ed;color:#113323">${formatInr(Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)))}</td>
      </tr>`)
    .join("");

  const isCod = isCodEmailMode(order.paymentMode);
  const deposit = Number(order.codDepositAmount ?? (isCod ? order.paymentReceived ?? 0 : 0));
  const balance = Number(
    order.codBalance ??
      (isCod ? Math.max(0, order.total - deposit - (order.walletAmountUsed || 0)) : 0),
  );
  const paymentNote =
    order.paymentMode === "admin_test"
      ? "This is an administrator-created test order. No payment was collected and no shipment will be booked."
      : isCod && deposit > 0
        ? `Your COD security deposit of ${formatInr(deposit)} was received. The remaining ${formatInr(balance)} will be collected at delivery.`
        : isCod
          ? `This order is Cash on Delivery. The full amount of ${formatInr(balance)} will be collected at delivery.`
          : "Your payment was received successfully.";
  const addressParts = [
    (order as any).address || order.address || (order as any).address1 || (order as any).address_line1,
    (order as any).address2 || (order as any).address_line2,
    order.city || (order as any).city || (order as any).town,
    order.state || (order as any).state || (order as any).province,
    order.pincode || (order as any).pincode || (order as any).zip,
  ].filter(Boolean);
  const address = addressParts.map(escapeHtml).join(", ");
  const contactInfo = order.phone ? `<p style="margin:0 0 8px">Phone: ${escapeHtml(order.phone)}</p>` : "";
  const addressSection = address
    ? `<h3 style="margin:18px 0 8px;color:#2b563f">Delivery address</h3><p style="margin:0 0 8px;color:#425b4b">${address}</p>${contactInfo}`
    : "";

  const paymentLabel =
    order.paymentMode === "admin_test"
      ? "Admin test order — no payment collected"
      : isCod
        ? deposit > 0
          ? `Cash on Delivery — ${formatInr(deposit)} deposit paid; ${formatInr(balance)} due at delivery`
          : `Cash on Delivery — ${formatInr(balance)} due at delivery`
        : `Prepaid — ${formatInr(order.paymentReceived ?? order.total)} paid online`;

  const paymentSummary =
    order.paymentMode === "admin_test"
      ? "No payment was collected for this test order."
      : isCod
        ? `Deposit received: ${formatInr(deposit)}. Remaining balance due at delivery: ${formatInr(balance)}.`
        : `Amount paid online: ${formatInr(order.paymentReceived ?? order.total)}.`;

  const logoUrl = String(process.env.ORDER_EMAIL_LOGO_URL || process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Succulent Sphere" width="64" height="64" style="display:block;border-radius:14px;object-fit:cover" />`
    : `<div style="width:64px;height:64px;border-radius:14px;background:linear-gradient(135deg,#2a6b46,#79b07a);box-shadow:0 8px 18px rgba(39,88,56,.18);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px">SS</div>`;

  return `<!doctype html>
  <html>
    <body style="margin:0;background:linear-gradient(180deg,#f6fbf6 0%,#eef6ee 100%);font-family:Inter,system-ui,Arial,sans-serif;color:#20352a">
      <main style="max-width:720px;margin:28px auto;padding:28px">
        <div style="border-radius:20px;padding:18px;background:linear-gradient(180deg,#ffffff,#f8fbf8);box-shadow: 0 18px 40px rgba(32,53,40,0.12), inset 0 1px 0 rgba(255,255,255,0.6);overflow:hidden">
          <header style="display:flex;align-items:center;gap:18px">
            ${logoHtml}
            <div>
              <p style="margin:0;font-size:12px;letter-spacing:1px;color:#4c6b57;font-weight:700">SUCCULENT SPHERE</p>
              <h1 style="margin:6px 0 0;font-size:22px;color:#163b2a">Order confirmed</h1>
              <p style="margin:4px 0 0;font-size:13px;color:#577567">Order #${escapeHtml(order.orderNumber)}</p>
            </div>
          </header>
          <section style="margin-top:18px;padding-top:8px;border-top:1px dashed #e6efe6">
            <div style="display:flex;gap:18px;align-items:flex-start">
              <div style="flex:1">
                <p style="margin:0 0 12px;font-size:15px;color:#254032">Hi ${escapeHtml(order.customerName || "there")},</p>
                <p style="margin:0 0 14px;color:#425b4b">${paymentNote}</p>
                <div style="border-radius:14px;padding:14px;background:linear-gradient(180deg,#fbfff9,#eef7ea);box-shadow:0 6px 18px rgba(32,53,40,0.06)">
                  <h2 style="margin:0 0 8px;font-size:15px;color:#1d4a35">Your plants</h2>
                  <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px">${items}</table>
                </div>
                ${addressSection}
              </div>
              <aside style="width:220px;flex-shrink:0">
                <div style="padding:12px;border-radius:12px;background:linear-gradient(180deg,#ffffff,#f4fbf4);box-shadow:0 12px 30px rgba(32,53,40,0.06)">
                  <p style="margin:0 0 8px;font-size:12px;color:#54705c">Order summary</p>
                  <p style="margin:0;font-size:18px;font-weight:700;color:#1f4a35">${formatInr(order.total)}</p>
                  <p style="margin:10px 0 0;font-size:12px;color:#637a6f">${paymentLabel}</p>
                </div>
              </aside>
            </div>
            <div style="margin-top:18px;padding:12px;border-radius:12px;background:#f6fbf6;border:1px solid #e9f2ea">
              <p style="margin:0;font-size:13px;color:#415a4d">${paymentSummary}</p>
            </div>
            <div style="margin-top:10px;padding:12px;border-radius:12px;background:#fff8ec;border:1px solid #f2e4c8">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#7a5b23">Didn&rsquo;t receive this email?</p>
              <p style="margin:0;font-size:13px;color:#6d5a33">Please check your <strong>Spam</strong> or <strong>Junk</strong> folder and the Promotions tab in your inbox &mdash; it may have landed there. If it still isn&rsquo;t showing, WhatsApp us on +91-9458321209 with your Order ID and we&rsquo;ll resend it right away.</p>
            </div>
            <footer style="margin-top:22px;display:flex;justify-content:space-between;align-items:center">
              <p style="margin:0;font-size:12px;color:#6b8774">Questions? Reply to this email and our plant team will help.</p>
              <p style="margin:0;font-size:12px;color:#4a6a57">&copy; ${new Date().getFullYear()} Succulent Sphere</p>
            </footer>
          </section>
        </div>
      </main>
    </body>
  </html>`;
}

function adminOrderHtml(order: OrderConfirmationEmail) {
  const shipping = Number(order.shipping || 0);
  const discount = Number(order.discount || 0);
  const codFee = Number(order.codFee || 0);
  const walletAmountUsed = Number(order.walletAmountUsed || 0);
  const cashbackEarned = Number(order.cashbackEarned || 0);
  const amountPaid = isCodEmailMode(order.paymentMode)
    ? Number(order.paymentReceived ?? 0)
    : Number(order.paymentReceived ?? order.payableAmount ?? order.total);
  const subtotal = order.total + discount + shipping - codFee;
  const fullAddress = [
    (order as any).address || order.address || (order as any).address1 || (order as any).address_line1,
    (order as any).address2 || (order as any).address_line2,
    order.city || (order as any).city || (order as any).town,
    order.state || (order as any).state || (order as any).province,
    order.pincode || (order as any).pincode || (order as any).zip,
  ].filter(Boolean).map((segment) => String(segment).trim()).filter(Boolean);

  const itemRows = order.items.map((item) => {
    const itemPrice = Number(item.price || 0);
    const quantity = Math.max(1, Number(item.quantity || 1));
    const lineTotal = itemPrice * quantity;
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #ebf1eb;vertical-align:top">${escapeHtml(item.title || "Plant")}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ebf1eb;text-align:center">${quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ebf1eb;text-align:right">${formatInr(itemPrice)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ebf1eb;text-align:right">${formatInr(lineTotal)}</td>
      </tr>`;
  }).join("");

  const adminLink = `${String(process.env.NEXT_PUBLIC_SITE_URL || "https://succulentsphere.com").replace(/\/+$/, "")}/admin?order=${encodeURIComponent(String(order.orderNumber))}`;

  return `<!doctype html>
  <html>
    <body style="margin:0;background:#f4f5f2;font-family:Arial,sans-serif;color:#1c3328">
      <div style="max-width:780px;margin:26px auto;padding:18px">
        <div style="border-radius:22px;background:linear-gradient(135deg,#ffffff,#f8faf5);border:1px solid #e1e8df;box-shadow:0 18px 40px rgba(20,38,28,0.08);overflow:hidden">
          <div style="padding:24px 28px;background:linear-gradient(135deg,#1d4c38,#3a6f52);color:#fff">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;font-weight:bold;opacity:0.9">NEW ORDER ALERT</p>
            <h1 style="margin:0;font-size:30px;line-height:1.2">Order #${escapeHtml(order.orderNumber)}</h1>
            <p style="margin:8px 0 0;font-size:14px;opacity:0.9">A fresh customer purchase has been received.</p>
          </div>
          <div style="padding:28px">
            <table width="100%" style="border-collapse:collapse;margin-bottom:20px">
              <tr>
                <td style="padding:0 0 14px;vertical-align:top;width:50%">
                  <div style="background:#f3f8f4;border:1px solid #def0de;border-radius:14px;padding:16px">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#587366;text-transform:uppercase">Customer</p>
                    <p style="margin:0 0 6px;font-size:18px;font-weight:bold;color:#163a2d">${escapeHtml(order.customerName || "Unknown customer")}</p>
                    <p style="margin:0 0 6px;color:#415b4b">${escapeHtml(order.customerEmail || "No email")}</p>
                    <p style="margin:0;color:#415b4b">${escapeHtml(order.phone || "No phone")}</p>
                  </div>
                </td>
                <td style="padding:0 0 14px;vertical-align:top;width:50%">
                  <div style="background:#f7f5ef;border:1px solid #efe4d7;border-radius:14px;padding:16px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#7b6753;text-transform:uppercase">Payment</p>
                    <p style="margin:0 0 6px;font-size:18px;font-weight:bold;color:#223d32">${escapeHtml(order.paymentMode === "cod_deposit" ? "COD Deposit" : order.paymentMode === "admin_test" ? "Admin Test" : "Prepaid")}</p>
                    <p style="margin:0 0 6px;color:#52665b">Amount paid: <strong>${formatInr(amountPaid)}</strong></p>
                    <p style="margin:0;color:#52665b">COD fee: ${formatInr(codFee)} · Shipping: ${formatInr(shipping)} · Discount: ${formatInr(discount)}</p>
                  </div>
                </td>
              </tr>
            </table>

            <div style="background:#f9fcf9;border:1px solid #e3efe5;border-radius:16px;padding:16px;margin-bottom:20px">
              <p style="margin:0 0 12px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#587366;text-transform:uppercase">Plants ordered</p>
              <table width="100%" style="border-collapse:collapse;font-size:14px;color:#1f382f">
                <thead>
                  <tr>
                    <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #dfe9df;color:#587366;font-size:12px;text-transform:uppercase">Product</th>
                    <th style="padding:10px 12px;border-bottom:1px solid #dfe9df;color:#587366;font-size:12px;text-transform:uppercase">Qty</th>
                    <th style="padding:10px 12px;border-bottom:1px solid #dfe9df;color:#587366;font-size:12px;text-transform:uppercase;text-align:right">Unit Price</th>
                    <th style="padding:10px 12px;border-bottom:1px solid #dfe9df;color:#587366;font-size:12px;text-transform:uppercase;text-align:right">Total</th>
                  </tr>
                </thead>
                <tbody>${itemRows}</tbody>
              </table>
            </div>

            <div style="background:#f7faf7;border:1px solid #e4efe2;border-radius:16px;padding:16px;margin-bottom:20px">
              <p style="margin:0 0 12px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#587366;text-transform:uppercase">Delivery address</p>
              <p style="margin:0;color:#274534;line-height:1.7">${escapeHtml(fullAddress.join(", ") || "Address not provided")}</p>
            </div>

            <div style="background:#eef7f1;border:1px solid #dfeee2;border-radius:16px;padding:16px;margin-bottom:20px">
              <p style="margin:0 0 10px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#587366;text-transform:uppercase">Financial summary</p>
              <table width="100%" style="border-collapse:collapse;font-size:14px;color:#1f382f">
                <tr>
                  <td style="padding:6px 0">Subtotal</td>
                  <td style="padding:6px 0;text-align:right">${formatInr(Math.max(0, subtotal))}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Shipping</td>
                  <td style="padding:6px 0;text-align:right">${formatInr(shipping)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Discount</td>
                  <td style="padding:6px 0;text-align:right">-${formatInr(discount)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Wallet used <span style="color:#7b6753">- deducted from customer wallet, not extra discount</span></td>
                  <td style="padding:6px 0;text-align:right">-${formatInr(walletAmountUsed)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">COD fee</td>
                  <td style="padding:6px 0;text-align:right">${formatInr(codFee)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Amount paid through Razorpay</td>
                  <td style="padding:6px 0;text-align:right">${formatInr(amountPaid)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Cashback credited after confirmation</td>
                  <td style="padding:6px 0;text-align:right">${formatInr(cashbackEarned)}</td>
                </tr>
                <tr style="border-top:1px solid #d7e8d8">
                  <td style="padding:10px 0 0;font-weight:bold">Total</td>
                  <td style="padding:10px 0 0;text-align:right;font-weight:bold">${formatInr(order.total)}</td>
                </tr>
              </table>
            </div>

            <div style="padding-top:4px">
              <a href="${escapeHtml(adminLink)}" style="display:inline-block;background:#1d4c38;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Open in Admin</a>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

export async function sendOrderConfirmationEmail(
  order: OrderConfirmationEmail,
) {
  if (!configuredEmailProvider()) {
    await getFirebaseDb()
      .collection("orders")
      .doc(order.orderId)
      .set(
        {
          emailStatus: "not_configured",
          emailUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return { sent: false, skipped: true };
  }

  try {
    console.log(`[order-email] attempting send to customer: ${order.customerEmail} (order:${order.orderNumber})`);
    const delivery = await sendEmail({
      to: order.customerEmail,
      subject: `Succulent Sphere — Order #${order.orderNumber} confirmed`,
      html: emailHtml(order),
      idempotencyKey: `order-confirmation-${order.orderId}`,
    });
    console.log(`[order-email] sent to ${order.customerEmail}`, { orderId: order.orderId, provider: delivery.provider, id: delivery.id });
    await getFirebaseDb()
      .collection("orders")
      .doc(order.orderId)
      .set(
        {
          emailStatus: "sent",
          emailProvider: delivery.provider,
          emailProviderId: delivery.id || "",
          emailSentAt: new Date().toISOString(),
        },
        { merge: true },
      );
    const rawAdmins = String(process.env.ADMIN_EMAILS || "").trim();
    if (rawAdmins) {
      const admins = rawAdmins.split(",").map((s) => String(s || "").trim()).filter(Boolean);
      for (const adminEmail of admins) {
        try {
          const adminDelivery = await sendEmail({
            to: adminEmail,
            subject: `New order #${order.orderNumber} — Succulent Sphere`,
            html: adminOrderHtml(order),
            idempotencyKey: `order-admin-notify-${order.orderId}-${adminEmail}`,
          });
          await getFirebaseDb().collection("orders").doc(order.orderId).set(
            {
              adminEmailStatus: "sent",
              adminEmailProvider: adminDelivery.provider,
              adminEmailProviderId: adminDelivery.id || "",
              adminEmailSentAt: new Date().toISOString(),
            },
            { merge: true },
          );
        } catch (adminErr) {
          await getFirebaseDb().collection("orders").doc(order.orderId).set(
            {
              adminEmailStatus: "failed",
              adminEmailError: String((adminErr as Error).message || adminErr).slice(0, 300),
              adminEmailUpdatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        }
      }
    }
    return { sent: true, skipped: false };
  } catch (error) {
    console.error("[order-email] send failed", (error as Error).message || error);
    await getFirebaseDb()
      .collection("orders")
      .doc(order.orderId)
      .set(
        {
          emailStatus: "failed",
          emailError: String(
            (error as Error).message || "Unable to send order email.",
          ).slice(0, 300),
          emailUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return { sent: false, skipped: false };
  }
}

export type OrderLifecycleStatus = "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

const LIFECYCLE_COPY: Record<
  OrderLifecycleStatus,
  { subject: string; heading: string; intro: string; detail: string; accent: string; button?: string }
> = {
  IN_TRANSIT: {
    subject: "is on its way",
    heading: "Your plants have left our studio",
    intro: "Good news — your plants are on the move.",
    detail:
      "We have packed your plants carefully and handed them to the courier. They are now travelling to you.",
    accent: "#1d573b",
  },
  OUT_FOR_DELIVERY: {
    subject: "is out for delivery",
    heading: "Your plants are out for delivery today",
    intro: "Your plants are with the delivery agent and should reach you today.",
    detail:
      "Please keep your phone nearby. The agent may call before arriving, and cash on delivery payments are collected at the door.",
    accent: "#1d573b",
  },
  DELIVERED: {
    subject: "was delivered",
    heading: "Your plants have arrived",
    intro: "Your order has been delivered. We hope the plants bring you a lot of joy.",
    detail:
      "A little care goes a long way — place succulents in bright, indirect light and water them only when the soil is fully dry.",
    accent: "#1d4c38",
  },
  CANCELLED: {
    subject: "has been cancelled",
    heading: "Your order has been cancelled",
    intro: "We are sorry — your order has been cancelled.",
    detail:
      "If you were charged online, the amount is released back to your original payment method and usually reflects in 5–7 business days. Any prepaid amount adjusted against cash on delivery is returned by refund.",
    accent: "#a3402f",
  },
};

/**
 * Sends the lifecycle email for a manual status change made by an admin
 * (in transit, out for delivery, delivered, cancelled). Returns the same shape
 * as the other mail helpers so callers can report sent/skipped/failed.
 */
export async function sendOrderStatusEmail(input: {
  orderId: string;
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  status: OrderLifecycleStatus;
  trackingNumber?: string;
  trackingUrl?: string;
  amountDue?: number;
}) {
  const copy = LIFECYCLE_COPY[input.status];
  if (!configuredEmailProvider()) return { sent: false, skipped: true };

  const trackingUrl =
    input.trackingUrl || (input.trackingNumber ? buildDelhiveryTrackingUrl(input.trackingNumber) : "");
  const dueNote =
    input.amountDue && input.amountDue > 0
      ? `<p style="margin:20px 0 0;padding:16px;border-radius:12px;background:#fdf6ec;border:1px solid #f0e0c4;font-size:14px;color:#7a5a1e">Please keep <strong style="color:#5c4212">${escapeHtml(
          `₹${Number(input.amountDue).toFixed(2)}`,
        )}</strong> ready for the delivery agent.</p>`
      : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f2;font-family:Arial,sans-serif;color:#20352a"><main style="max-width:620px;margin:28px auto;background:#fff;border:1px solid #e2e8e1;border-radius:20px;overflow:hidden"><header style="padding:30px;background:linear-gradient(135deg,#173c2d,#356649);color:#fff"><p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:2px">SUCCULENT SPHERE</p><h1 style="margin:12px 0 0;font-size:26px">${escapeHtml(copy.heading)}</h1></header><section style="padding:30px"><p style="font-size:16px">Hi ${escapeHtml(
    input.customerName || "there",
  )},</p><p>${escapeHtml(copy.intro)}</p><p>Order <strong>#${escapeHtml(input.orderNumber)}</strong> ${escapeHtml(copy.subject)}.</p><p style="color:#607267">${escapeHtml(copy.detail)}</p>${dueNote}${
    trackingUrl
      ? `<p style="margin:24px 0"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:${copy.accent};color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:bold">Track your shipment</a></p>`
      : ""
  }</section><footer style="padding:18px 30px;background:#f7f9f6;color:#718076;font-size:12px">Questions? Reply to this email and our plant team will help.</footer></main></body></html>`;

  try {
    const delivery = await sendEmail({
      to: input.customerEmail,
      subject: `Your Succulent Sphere order #${input.orderNumber} ${copy.subject}`,
      html,
      idempotencyKey: `status-${input.orderId}-${input.status}`,
    });
    await getFirebaseDb()
      .collection("orders")
      .doc(input.orderId)
      .set(
        {
          [`statusEmail_${input.status}`]: {
            status: "sent",
            provider: delivery.provider,
            sentAt: new Date().toISOString(),
          },
        },
        { merge: true },
      );
    return { sent: true, skipped: false };
  } catch (error) {
    await getFirebaseDb()
      .collection("orders")
      .doc(input.orderId)
      .set(
        {
          [`statusEmail_${input.status}`]: {
            status: "failed",
            error: String((error as Error).message).slice(0, 300),
            updatedAt: new Date().toISOString(),
          },
        },
        { merge: true },
      );
    return { sent: false, skipped: false };
  }
}

export async function sendTrackingEmail(input: {
  orderId: string;
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  trackingNumber: string;
  trackingUrl?: string;
  carrier?: string;
}) {
  if (!configuredEmailProvider()) return { sent: false, skipped: true };
  const carrier = input.carrier || "Delhivery";
  const trackingUrl = input.trackingUrl || buildDelhiveryTrackingUrl(input.trackingNumber);
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f2;font-family:Arial,sans-serif;color:#20352a"><main style="max-width:620px;margin:28px auto;background:#fff;border:1px solid #e2e8e1;border-radius:20px;overflow:hidden"><header style="padding:30px;background:linear-gradient(135deg,#173c2d,#356649);color:#fff"><p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:2px">SUCCULENT SPHERE</p><h1 style="margin:12px 0 0;font-size:28px">Your plants are on their way</h1></header><section style="padding:30px"><p style="font-size:16px">Hi ${escapeHtml(input.customerName || "there")},</p><p>Great news — order <strong>#${escapeHtml(input.orderNumber)}</strong> has been handed to ${escapeHtml(carrier)}.</p><div style="margin:24px 0;padding:20px;border-radius:14px;background:#edf6ee;border:1px solid #d7ead9"><p style="margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:1px;color:#54705c">TRACKING NUMBER</p><p style="margin:0;font-size:22px;font-weight:bold;color:#1d4a35">${escapeHtml(input.trackingNumber)}</p></div><p style="margin:24px 0"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#1d573b;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:bold">Track your shipment</a></p><p style="font-size:13px;line-height:1.6;color:#607267">The tracking page can take a little time to show its first scan after dispatch. Please keep this email for your reference.</p></section><footer style="padding:18px 30px;background:#f7f9f6;color:#718076;font-size:12px">Questions? Reply to this email and our plant team will help.</footer></main></body></html>`;
  try {
    const delivery = await sendEmail({
      to: input.customerEmail,
      subject: `Your Succulent Sphere order #${input.orderNumber} is on its way`,
      html,
      idempotencyKey: `tracking-${input.orderId}-${input.trackingNumber}`,
    });
    await getFirebaseDb()
      .collection("orders")
      .doc(input.orderId)
      .set(
        {
          trackingEmailStatus: "sent",
          trackingEmailProvider: delivery.provider,
          trackingEmailSentAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return { sent: true, skipped: false };
  } catch (error) {
    await getFirebaseDb()
      .collection("orders")
      .doc(input.orderId)
      .set(
        {
          trackingEmailStatus: "failed",
          trackingEmailError: String((error as Error).message).slice(0, 300),
          trackingEmailUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return { sent: false, skipped: false };
  }
}
