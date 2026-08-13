import "server-only";

import { getFirebaseDb } from "@/lib/firebase-admin";
import { configuredEmailProvider, sendEmail } from "@/lib/email-sender";

type OrderEmailItem = { title?: string; quantity?: number; price?: string; image?: string; imageAlt?: string };

export type OrderConfirmationEmail = {
  orderId: string;
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  items: OrderEmailItem[];
  total: number;
  paymentMode: "prepaid" | "cod_deposit" | "admin_test";
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  shipping?: number;
  discount?: number;
  codFee?: number;
  paymentReceived?: number;
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

  const paymentNote =
    order.paymentMode === "admin_test"
      ? "This is an administrator-created test order. No payment was collected and no shipment will be booked."
      : order.paymentMode === "cod_deposit"
        ? "Your COD security deposit was received. The remaining balance will be collected at delivery."
        : "Your payment was received successfully.";
  // Build address from any commonly used fields to handle different order shapes
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
      : order.paymentMode === "cod_deposit"
        ? `Cash on Delivery — ${formatInr(order.paymentReceived ?? 0)} deposit paid; remaining balance at delivery`
        : `Prepaid — ${formatInr(order.paymentReceived ?? order.total)} paid online`;

  const paymentSummary =
    order.paymentMode === "admin_test"
      ? "No payment was collected for this test order."
      : order.paymentMode === "cod_deposit"
        ? `Deposit received: ${formatInr(order.paymentReceived ?? 0)}. Remaining balance due at delivery.`
        : `Amount paid online: ${formatInr(order.paymentReceived ?? order.total)}.`;

  // allow a configured logo URL to be used in place of the initials block
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
    // Also notify admins if ADMIN_EMAILS env is set (comma-separated)
    const rawAdmins = String(process.env.ADMIN_EMAILS || "").trim();
    if (rawAdmins) {
      const admins = rawAdmins.split(",").map((s) => String(s || "").trim()).filter(Boolean);
      for (const adminEmail of admins) {
        try {
          const adminUrlBase = String(process.env.NEXT_PUBLIC_SITE_URL || "https://succulentsphere.com").replace(/\/+$/,'');
          // Link to admin dashboard with orderNumber query so admin can search quickly
          const adminLink = `${adminUrlBase}/admin?order=${encodeURIComponent(String(order.orderNumber))}`;
          const adminHtml = `<p>New order <strong>#${escapeHtml(order.orderNumber)}</strong> by ${escapeHtml(order.customerName)} (${escapeHtml(order.customerEmail)}). Total: <strong>${formatInr(order.total)}</strong>.</p><p><a href="${escapeHtml(adminLink)}">Open in Admin</a></p>`;
          const adminDelivery = await sendEmail({
            to: adminEmail,
            subject: `New order #${order.orderNumber} — Succulent Sphere`,
            html: adminHtml,
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
  const trackingUrl =
    input.trackingUrl ||
    `https://www.delhivery.com/track/package/${encodeURIComponent(input.trackingNumber)}`;
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
