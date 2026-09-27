import "server-only";

import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { configuredEmailProvider, sendEmail } from "@/lib/email-sender";
import { buildResetPasswordEmail } from "@/lib/email-templates/resetPassword";

/**
 * Generates a Firebase reset link and sends it as a branded Succulent Sphere
 * email.
 *
 * Why not `accounts:sendOobCode` (what /api/forgot-password used to call): that
 * endpoint mails Firebase's own template, which is an unbranded English message
 * from an unfamiliar sender. A password reset is the message where sender
 * familiarity carries the most weight and where a generic-looking one does the
 * most damage — a customer who cannot tell it apart from phishing will simply
 * not reset, and a customer targeted by a real phisher has no reason to doubt
 * it. Generating the link and mailing it ourselves puts the brand on the one
 * email that must not look like a lure.
 *
 * Never throws. The caller is an unauthenticated endpoint whose response must
 * not vary with whether an address has an account, so every outcome is folded
 * into a returned result and the reason is logged rather than raised.
 */

type SendResetOptions = {
  email: string;
  displayName?: string | null;
  siteUrl?: string | null;
  supportPhone?: string | null;
  assetBaseUrl?: string | null;
};

export type SendPasswordResetResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  /** Present only on success. Never logged — it is a live credential. */
  resetUrl?: string;
};

export async function sendPasswordResetEmail(
  opts: SendResetOptions,
): Promise<SendPasswordResetResult> {
  const email = String(opts.email || "").trim().toLowerCase();
  if (!email) return { sent: false, skipped: true, reason: "missing_email" };

  if (!configuredEmailProvider()) {
    console.warn("[reset-email] no email provider configured; not sending");
    return { sent: false, skipped: true, reason: "not_configured" };
  }

  // Firebase only accepts an action URL on a domain listed in the project's
  // authorised domains, so this must be the real site origin. Falling back to
  // the configured site URL rather than a bare hostname is deliberate: the
  // action URL has to be absolute.
  const siteUrl = String(
    opts.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://succulentsphere.com",
  )
    .trim()
    .replace(/\/+$/, "");

  let oobCode = "";
  try {
    const actionUrl = `${siteUrl}/reset-password`;
    const link = await getFirebaseAdminAuth().generatePasswordResetLink(email, {
      url: actionUrl,
    });
    // Firebase returns its own hosted action page carrying the web API key. The
    // oobCode is the part our /reset-password page actually needs, so pull it
    // out and let the template build a clean link on our own domain.
    oobCode = new URL(link).searchParams.get("oobCode") || "";
    if (!oobCode) {
      throw new Error("Generated reset link carried no oobCode.");
    }
  } catch (error) {
    const message = String((error as Error)?.message || error);
    // "user-not-found" is the expected result for an address with no account and
    // is not an error worth alarming about. It is still not distinguished in
    // the response, only here in the log.
    if (/user-not-found/i.test(message)) {
      console.log(`[reset-email] no Firebase user for ${email}`);
      return { sent: false, skipped: true, reason: "user_not_found" };
    }
    console.error(`[reset-email] could not generate a link for ${email}: ${message}`);
    return { sent: false, skipped: false, reason: "link_failed" };
  }

  try {
    const built = buildResetPasswordEmail({
      email,
      oobCode,
      displayName: opts.displayName,
      siteUrl,
      supportPhone: opts.supportPhone,
      assetBaseUrl: opts.assetBaseUrl,
    });

    const delivery = await sendEmail({
      to: email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      // No idempotency key, deliberately. Every request mints a new oobCode, so
      // two reset emails are two different credentials and both are legitimate —
      // a customer whose first link expired must not be de-duplicated out of
      // their second one. Abuse is bounded by the rate limit on the route
      // instead, which is the layer that can tell a retry from an attack.
    });

    console.log(`[reset-email] sent to ${email}`, {
      provider: delivery.provider,
      id: delivery.id,
    });
    return { sent: true, skipped: false, resetUrl: built.resetUrl };
  } catch (error) {
    const message = String((error as Error)?.message || error).slice(0, 300);
    console.error(`[reset-email] failed for ${email}: ${message}`);
    return { sent: false, skipped: false, reason: "send_failed" };
  }
}

export default sendPasswordResetEmail;
