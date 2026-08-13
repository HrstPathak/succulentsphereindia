import "server-only";

import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email-sender";
import buildResetPasswordEmail from "@/lib/email-templates/resetPassword";
import { SITE_NAME } from "@/lib/seo";

type SendResetOptions = {
  email: string;
  displayName?: string | null;
  continueUrl?: string; // URL users will be redirected to after resetting
  supportEmail?: string;
  logoUrl?: string | null;
};

export async function sendPasswordResetEmail(opts: SendResetOptions) {
  const email = String(opts.email || "").trim();
  if (!email) throw new Error("Email is required to send password reset.");

  const auth = getFirebaseAdminAuth();
  const actionUrl = String(opts.continueUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://succulentsphere.com");

  const resetLink = await auth.generatePasswordResetLink(email, { url: actionUrl });

  const html = buildResetPasswordEmail({
    email,
    displayName: opts.displayName || null,
    resetLink,
    siteName: SITE_NAME,
    supportEmail: opts.supportEmail || String(process.env.ORDER_SUPPORT_EMAIL || ""),
    logoUrl: opts.logoUrl || String(process.env.ORDER_EMAIL_LOGO_URL || ""),
  });

  const subject = `Reset your ${SITE_NAME} password`;
  const idempotencyKey = `reset:${email}:${Math.floor(Date.now() / 1000)}`;

  const result = await sendEmail({ to: email, subject, html, idempotencyKey });
  return { result, resetLink };
}

export default sendPasswordResetEmail;
