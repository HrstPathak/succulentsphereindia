import "server-only";

import nodemailer from "nodemailer";

export type InlineImage = {
  /** Referenced from the HTML as `cid:<cid>`. */
  cid: string;
  content: Buffer;
  contentType: string;
  filename: string;
};

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
  /**
   * Images to embed in the body as Content-ID parts, referenced as
   * `cid:<cid>`.
   *
   * This exists because Gmail blocks remote images by default. A product
   * thumbnail linked with https:// is a grey placeholder until the reader
   * clicks "Display images", which for an order confirmation is the same as no
   * thumbnail at all. Embedded parts travel inside the message, so they render
   * without a click.
   */
  inlineImages?: InlineImage[];
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
        // Resend has no separate inline flag: an attachment referenced from the
        // body as cid:<filename> is served from the MIME part rather than
        // fetched over the network, which is the whole point.
        ...(message.inlineImages?.length
          ? {
              attachments: message.inlineImages.map((image) => ({
                filename: image.filename,
                content: image.content.toString("base64"),
                content_type: image.contentType,
              })),
            }
          : {}),
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
    // A `cid` on an attachment is what makes it inline: Nodemailer emits a MIME
    // part with a Content-ID header and the HTML's `cid:` reference resolves
    // against it, so no network fetch happens at render time.
    ...(message.inlineImages?.length
      ? {
          attachments: message.inlineImages.map((image) => ({
            filename: image.filename,
            content: image.content,
            contentType: image.contentType,
            cid: image.cid,
            contentDisposition: "inline" as const,
          })),
        }
      : {}),
  });
  return { id: result.messageId || null, provider: "gmail" };
}
