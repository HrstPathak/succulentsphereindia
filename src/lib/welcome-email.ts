import "server-only";

/**
 * Sends the one-time welcome email after a customer account is created.
 *
 * Deliberately shaped like sendOrderConfirmationEmail in order-email.ts, and
 * for the same reasons: the template owns its own subject, preheader, HTML and
 * plain-text twin, so the customer copy and the text fallback cannot drift; and
 * the outcome is written back to the user document so a failed send is visible
 * rather than silent.
 *
 * Never throws. A welcome is a courtesy, not a transaction, and the caller is a
 * signup handler — the account is already created and the session already
 * issued by the time this runs. Letting an image host or a mail provider error
 * escape would turn a successful signup into a 500 and a customer retrying
 * against an email that already exists. Every failure is recorded and swallowed.
 */

import { getFirebaseDb } from "@/lib/firebase-admin";
import { configuredEmailProvider, sendEmail } from "@/lib/email-sender";
import { buildWelcomeEmail } from "@/lib/email-templates/welcomeEmail";
import { buildWelcomeImages } from "@/lib/welcome-email-assets";

export type WelcomeEmailInput = {
  /** Firebase uid. Used as the document id and the idempotency key. */
  uid: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

export type WelcomeEmailResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
};

async function record(uid: string, patch: Record<string, unknown>) {
  try {
    await getFirebaseDb()
      .collection("users")
      .doc(uid)
      .set({ welcomeEmailUpdatedAt: new Date().toISOString(), ...patch }, { merge: true });
  } catch (error) {
    // Losing the audit trail must not turn a delivered welcome into a failure.
    console.warn(
      `[welcome-email] could not record status for ${uid}: ${String((error as Error)?.message || error)}`,
    );
  }
}

export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<WelcomeEmailResult> {
  const uid = String(input.uid || "").trim();
  const email = String(input.email || "").trim().toLowerCase();

  if (!uid || !email) {
    return { sent: false, skipped: true, reason: "missing_uid_or_email" };
  }
  if (!configuredEmailProvider()) {
    await record(uid, { welcomeEmailStatus: "not_configured" });
    return { sent: false, skipped: true, reason: "not_configured" };
  }

  try {
    // Embedded before the template is built: the cid is allocated here and has
    // to be baked into the markup. Best-effort — a photo that will not load
    // falls back to its hosted URL rather than failing the send.
    const artwork = await buildWelcomeImages();
    if (artwork.skipped.length) {
      console.warn(
        `[welcome-email] artwork unavailable for: ${artwork.skipped.join(", ")}`,
      );
    }

    const built = buildWelcomeEmail({
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      images: artwork.images,
    });

    const delivery = await sendEmail({
      to: email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      ...(artwork.attachments.length ? { inlineImages: artwork.attachments } : {}),
      // One welcome per account. The provider drops a repeat, so a retried
      // signup or a double-fired hook cannot send a second one.
      idempotencyKey: `welcome-email-${uid}`,
    });

    console.log(`[welcome-email] sent to ${email}`, {
      uid,
      provider: delivery.provider,
      id: delivery.id,
      artworkBytes: artwork.bytes,
    });
    await record(uid, {
      welcomeEmailStatus: "sent",
      welcomeEmailProvider: delivery.provider,
      welcomeEmailProviderId: delivery.id || "",
      welcomeEmailSentAt: new Date().toISOString(),
    });
    return { sent: true, skipped: false };
  } catch (error) {
    const message = String((error as Error)?.message || error).slice(0, 300);
    console.error(`[welcome-email] failed for ${email}: ${message}`);
    await record(uid, { welcomeEmailStatus: "failed", welcomeEmailError: message });
    return { sent: false, skipped: false, reason: "send_failed" };
  }
}

export default sendWelcomeEmail;
