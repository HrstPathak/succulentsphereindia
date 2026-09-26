import "server-only";

import nodemailer from "nodemailer";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  /**
   * Plain-text alternative. Optional for backwards compatibility, but every
   * new email should pass it: text-only clients show this instead of raw HTML,
   * and Gmail's "View entire message" renders it. Resend and Nodemailer both
   * turn this into a real multipart/alternative message when it is present.
   */
  text?: string;
  idempotencyKey?: string;
};
export type EmailDelivery = { id: string | null; provider: "resend" | "gmail" };

function gmailConfig() {
  const user = String(process.env.GMAIL_USER || "").trim();
  const appPassword = String(process.env.GMAIL_APP_PASSWORD || "").replace(
    /\s/g,
    "",
  );
  return user && appPassword ? { user, appPassword } : null;
}

export function configuredEmailProvider(): "resend" | "gmail" | null {
  if (
    String(process.env.RESEND_API_KEY || "").trim() &&
    String(process.env.ORDER_EMAIL_FROM || "").trim()
  )
    return "resend";
  return gmailConfig() ? "gmail" : null;
}

export async function sendEmail(message: EmailMessage): Promise<EmailDelivery> {
  const resendKey = String(process.env.RESEND_API_KEY || "").trim();
  const resendFrom = String(process.env.ORDER_EMAIL_FROM || "").trim();
  if (resendKey && resendFrom) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey
          ? { "Idempotency-Key": message.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        ...(message.text ? { text: message.text } : {}),
      }),
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        String(body?.message || "Email provider rejected the request."),
      );
    return { id: String(body?.id || "") || null, provider: "resend" };
  }

  const gmail = gmailConfig();
  if (!gmail)
    throw new Error(
      "Email is not configured. Add RESEND_API_KEY and ORDER_EMAIL_FROM, or free Gmail settings GMAIL_USER and GMAIL_APP_PASSWORD.",
    );
  const fromName =
    String(process.env.GMAIL_FROM_NAME || "Succulent Sphere").trim() ||
    "Succulent Sphere";
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmail.user, pass: gmail.appPassword },
  });
  const result = await transporter.sendMail({
    from: `${fromName} <${gmail.user}>`,
    to: message.to,
    subject: message.subject,
    html: message.html,
    // Nodemailer builds a multipart/alternative message when both parts are set.
    ...(message.text ? { text: message.text } : {}),
  });
  return { id: result.messageId || null, provider: "gmail" };
}
