export type ResetPasswordEmailOptions = {
  displayName?: string | null;
  email: string;
  resetLink: string;
  siteName?: string;
  supportEmail?: string;
  logoUrl?: string | null;
};

export function buildResetPasswordEmail(opts: ResetPasswordEmailOptions): string {
  const displayName = opts.displayName ? String(opts.displayName).trim() : "";
  const siteName = String(opts.siteName || "Succulent Sphere").trim();
  const supportEmail = String(opts.supportEmail || `support@${new URL((process.env.NEXT_PUBLIC_SITE_URL || "https://succulentsphere.com")).host}`).trim();
  const logoUrl = String(opts.logoUrl || "").trim();
  const preheader = `${siteName} password reset link for ${opts.email}`;

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Reset your password</title>
    <style>
      /* Simple, widely-compatible email styles */
      body { background: #f7f7f7; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 8px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
      .header { padding: 20px; text-align: left; background: linear-gradient(90deg,#ffffff,#ffffff); }
      .logo { height: 40px; }
      .content { padding: 28px 24px; color: #1f2937; }
      h1 { font-size: 20px; margin: 0 0 8px; }
      p { margin: 0 0 16px; line-height: 1.45; }
      .btn-wrap { text-align: center; margin: 22px 0; }
      .btn { background: #10b981; color: white; text-decoration: none; padding: 12px 20px; border-radius: 6px; display: inline-block; font-weight: 600; }
      .small { font-size: 13px; color: #6b7280; }
      .muted { color: #9ca3af; font-size: 13px; }
      .footer { padding: 18px 24px; background: #fafafa; font-size: 12px; color: #6b7280; }
      @media (max-width:420px) { .container { margin: 12px; } .content { padding: 18px 16px; } }
    </style>
  </head>
  <body>
    <span style="display:none!important;max-height:0px;overflow:hidden;">${preheader}</span>
    <div class="container">
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" alt="${siteName} logo" class="logo"/>` : `<div style="font-weight:700;color:#111827">${siteName}</div>`}
      </div>
      <div class="content">
        <h1>Password reset request</h1>
        <p>Hi ${displayName || "there"},</p>
        <p>We received a request to reset the password for the account using <strong>${opts.email}</strong>. Click the button below to reset your password. This link will expire shortly.</p>

        <div class="btn-wrap">
          <a class="btn" href="${opts.resetLink}" target="_blank" rel="noopener">Reset your password</a>
        </div>

        <p class="small">If the button doesn't work, paste this link into your browser:</p>
        <p class="muted"><a href="${opts.resetLink}" target="_blank" rel="noopener" style="color:#6b7280">${opts.resetLink}</a></p>

        <p class="small">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
      </div>
      <div class="footer">
        <div>Need help? Email us at <a href="mailto:${supportEmail}">${supportEmail}</a></div>
        <div style="margin-top:8px">&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</div>
      </div>
    </div>
  </body>
</html>
`;
}

export default buildResetPasswordEmail;
