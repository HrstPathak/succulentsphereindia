import {
  BRAND,
  DEFAULT_SUPPORT_PHONE,
  FONT_SANS,
  FONT_SERIF,
  PANEL_WIDTH,
  PREHEADER_PAD,
  assetBaseUrl,
  assetUrl,
  brandFooter,
  cta,
  documentShell,
  escapeHtml,
  masthead,
  origin,
  signature,
  trustClaimsLine,
  trustStrip,
} from "./emailChrome";

/**
 * The password-reset email.
 *
 * Rebuilt on the shared chrome. The version this replaces was a standalone
 * one-off, and it differed from every other email this brand sends in ways that
 * mattered:
 *
 *   1. It interpolated `displayName`, `email`, `resetLink` and `supportEmail`
 *      into the markup with no escaping at all. A display name is attacker-
 *      controlled — it is whatever the customer typed at signup — so this was a
 *      live HTML-injection path into an inbox, on the one email where an
 *      injected link is most convincing. Everything goes through escapeHtml()
 *      now.
 *   2. It had no plain-text twin, so text-only readers and Gmail's "View
 *      entire message" got raw HTML — and on a security email the link is the
 *      whole point, so it has to survive in text.
 *   3. It was off-brand: a generic emerald button, slate-grey body copy and a
 *      `#f7f7f7` page, none of which are this palette. It also read the year
 *      from the clock, so two renders of the same input differed.
 *
 * What it does keep is the security copy, which was the one part already right
 * and which a branded redesign must not talk its way around: the expiry is
 * stated, the full URL is always shown, and a reader who did not ask for this
 * is told plainly what to do.
 *
 * Structure follows the status email — masthead, dark panel, copy, CTA, trust
 * strip, signature, branded footer — so a customer moving between emails does
 * not have to re-learn the layout.
 */

export type ResetPasswordEmailInput = {
  email: string;
  /** Firebase oobCode. The template builds the customer-facing link itself. */
  oobCode: string;
  displayName?: string | null;
  siteUrl?: string | null;
  assetBaseUrl?: string | null;
  supportPhone?: string | null;
};

export type ResetPasswordEmail = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
  /** The absolute URL the customer clicks, echoed back for logging/tests. */
  resetUrl: string;
};

/**
 * Narrow, once per email type, because the surrounding screen is 620px.
 * Every rule only widens, unhides or centres — see the note on
 * documentShell() about the style block being progressive enhancement.
 */
const RESET_MEDIA_CSS = [
  "        .ss-pad { padding-left:22px !important; padding-right:22px !important; }",
  "        .ss-masthead { padding-left:22px !important; padding-right:22px !important; }",
  "        .ss-hide-sm { display:none !important; }",
  "        .ss-panel-pad { padding:28px 22px 26px 22px !important; }",
  "        .ss-eyebrow { font-size:9.5px !important; letter-spacing:2.2px !important; }",
  "        .ss-headline { font-size:26px !important; line-height:1.18 !important; }",
  "        .ss-lede { font-size:14.5px !important; line-height:1.6 !important; }",
  "        /* The bare-URL fallback is already a long token; let it break rather",
  "           than force the panel to scroll sideways at 320px. */",
  "        .ss-break { word-break:break-all !important; }",
].join("\n");

/** A quiet tinted card, for the reassurance and expiry notes. */
function notePanel(args: { heading: string; body: string }) {
  return `<tr>
            <td class="ss-pad" style="padding:24px 34px 0">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.cream};border-radius:14px"><tr>
                <td style="padding:20px 22px">
                  <div style="font-family:${FONT_SANS};font-size:10px;letter-spacing:1.6px;font-weight:bold;color:${BRAND.panelLight}">${escapeHtml(args.heading.toUpperCase())}</div>
                  <div style="padding-top:8px;font-family:${FONT_SANS};font-size:13.5px;line-height:1.65;color:${BRAND.body}">${args.body}</div>
                </td>
              </tr></table>
            </td>
          </tr>`;
}
export function buildResetPasswordEmail(
  input: ResetPasswordEmailInput,
): ResetPasswordEmail {
  const email = String(input.email || "").trim().toLowerCase();
  const oobCode = String(input.oobCode || "").trim();
  const base = assetBaseUrl(input.assetBaseUrl);
  const siteUrl = origin(input.siteUrl, "https://succulentsphere.com").replace(
    /\/+$/,
    "",
  );
  const siteHost = siteUrl.replace(/^https?:\/\//, "");
  const phone = String(input.supportPhone || DEFAULT_SUPPORT_PHONE).trim();

  // The link is rebuilt here rather than passed in finished, so the emailed URL
  // is always this site's own /reset-password page carrying only the oobCode.
  // The link Firebase generates also carries the web API key and a continueUrl;
  // neither belongs in a URL a customer is invited to click.
  const resetUrl = `${siteUrl}/reset-password?oobCode=${encodeURIComponent(oobCode)}`;

  const displayName = String(input.displayName || "").trim();
  const greeting = displayName ? `Hi ${displayName},` : "Hi there,";

  const subject = "Reset your Succulent Sphere password";

  // The preheader states the consequence of ignoring the message, because
  // "Reset your password" is also the exact subject a phishing mail would use —
  // this is one of the few places we get to prove we are us.
  const preheader =
    "A secure link to set a new password. It expires shortly, and it only " +
    "works if you asked for it.";

  const html = documentShell({
    title: subject,
    mediaCss: RESET_MEDIA_CSS,
    preheaderHtml: `${escapeHtml(preheader)} ${PREHEADER_PAD}`,
    bodyHtml: `      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${PANEL_WIDTH}px;margin:0 auto;background:${BRAND.card};border-radius:16px;overflow:hidden">
        <tr>
          <td class="ss-masthead" style="padding:0">${masthead({
            logoUrl: assetUrl(base, "logo-mark.png"),
          })}</td>
        </tr>
        <tr>
          <td class="ss-panel-pad" bgcolor="${BRAND.panel}" style="padding:32px 34px 30px;background:${BRAND.panel}">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td class="ss-eyebrow" style="font-family:${FONT_SANS};font-size:10px;letter-spacing:2.6px;font-weight:bold;color:${BRAND.panelEyebrow}">ACCOUNT SECURITY</td>
              </tr>
              <tr>
                <td style="padding-top:12px">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="26" style="width:26px"><tr>
                    <td width="26" style="width:26px;border-top:2px solid ${BRAND.panelRule}">&nbsp;</td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td class="ss-headline" style="padding-top:16px;font-family:${FONT_SERIF};font-size:30px;line-height:1.2;color:#FFFFFF">Reset your password</td>
              </tr>
              <tr>
                <td class="ss-lede" style="padding-top:12px;font-family:${FONT_SANS};font-size:14.5px;line-height:1.65;color:${BRAND.panelText}">
                  ${escapeHtml(greeting)} Someone asked to set a new password for the account using <strong style="color:#FFFFFF">${escapeHtml(email)}</strong>. Use the button below to choose a new one.
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="ss-pad" align="center" style="padding:28px 34px 0">
            ${cta({
              label: "Set a new password",
              url: resetUrl,
              iconUrl: assetUrl(base, "icon-shield-white.png"),
              iconWidth: 18,
              iconHeight: 18,
            })}
          </td>
        </tr>
        <tr>
          <td class="ss-pad" align="center" style="padding:14px 34px 0">
            <!-- Bare URL fallback, always present for text-only clients and for
                 any client that will not render a button. Security copy too: it
                 lets the reader confirm they are on the real domain.

                 The table-layout:fixed wrapper is load-bearing. An oobCode is
                 ~86 characters, and without fixed layout the cell is sized by
                 its content, so the token widens the cell instead of wrapping
                 inside it and the row spills past the panel edge. On a 375px
                 phone that is a 40px horizontal scroll for the whole email —
                 and because a screenshot is only of the viewport, it still looks
                 fine in a PNG. -->

            <!-- NOTE: no backticks in any comment inside this template literal;
                 they would close the string. -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout:fixed"><tr>
              <td align="center" class="ss-break" style="font-family:${FONT_SANS};font-size:11.5px;line-height:1.7;color:${BRAND.muted};word-break:break-all;overflow-wrap:break-word">
                If the button does not work, paste this link into your browser:<br />
                <a href="${escapeHtml(resetUrl)}" style="color:${BRAND.panelLight}">${escapeHtml(resetUrl)}</a>
              </td>
            </tr></table>
          </td>
        </tr>



        ${notePanel({
          heading: "If you did not ask for this",
          body:
            "You can safely ignore this email &mdash; your password will not " +
            "change and nothing has been altered on your account. If you were " +
            "not expecting it, someone may have typed your address in by " +
            `mistake, and it is worth <a href="${escapeHtml(
              `${siteUrl}/login`,
            )}" style="color:${BRAND.panelLight}">signing in</a> to check everything looks right.`,
        })}
        ${notePanel({
          heading: "This link expires",
          body:
            "For your security the link works once and stops working after a " +
            "short while. If it has expired, request a new one from the " +
            `<a href="${escapeHtml(
              `${siteUrl}/forgot-password`,
            )}" style="color:${BRAND.panelLight}">forgot password page</a> and the next one will work.`,
        })}
        ${trustStrip({ base })}
        ${signature({ base })}
        ${brandFooter({
          siteUrl,
          siteHost,
          phone,
          claims: [
            { label: "Premium Quality Plants", iconUrl: assetUrl(base, "icon-leaf-white.png"), iconWidth: 17, iconHeight: 17 },
            { label: "Carefully Packed", iconUrl: assetUrl(base, "icon-shield-white.png"), iconWidth: 18, iconHeight: 18 },
            { label: "Safe & Reliable Delivery", iconUrl: assetUrl(base, "icon-truck-white.png"), iconWidth: 21, iconHeight: 15 },
            { label: "Plant Care Support", iconUrl: assetUrl(base, "icon-heart-white.png"), iconWidth: 18, iconHeight: 18 },
          ],
          social: [
            { label: "Instagram", url: "https://www.instagram.com/succulentsphere/", iconUrl: assetUrl(base, "icon-social-instagram.png") },
            { label: "Facebook", url: "https://www.facebook.com/profile.php?id=61586867373040", iconUrl: assetUrl(base, "icon-social-facebook.png") },
          ],
          reason: `You are receiving this because a password reset was requested for your account at ${siteHost}.`,
        })}
      </table>`,
  });

  return {
    subject,
    preheader,
    html,
    text: buildPlainText({
      greeting,
      email,
      resetUrl,
      loginUrl: `${siteUrl}/login`,
      forgotUrl: `${siteUrl}/forgot-password`,
    }),
    resetUrl,
  };
}

/**
 * Plain-text twin.
 *
 * On this email the text part is not a courtesy. A security email whose only
 * call to action is a link has to survive being read in a client that shows
 * nothing but text, so the link is repeated in full rather than summarised.
 */
function buildPlainText(args: {
  greeting: string;
  email: string;
  resetUrl: string;
  loginUrl: string;
  forgotUrl: string;
}) {
  return `${args.greeting}

Someone asked to set a new password for the account using ${args.email}.
Use the link below to choose a new one.

  Set a new password:
  ${args.resetUrl}

If the link does not work, copy the address above into your browser.

IF YOU DID NOT ASK FOR THIS
  You can safely ignore this email. Your password will not change and nothing
  has been altered on your account. If you were not expecting it, someone may
  have typed your address in by mistake, and it is worth signing in to check
  everything looks right: ${args.loginUrl}

THIS LINK EXPIRES
  For your security the link works once and stops working after a short while.
  If it has expired, request a new one from: ${args.forgotUrl}

WHY YOU ARE GETTING THIS
  ${trustClaimsLine()}

Questions about your account? Just reply to this email and our plant team
will help.

Succulent Sphere
`;
}

export default buildResetPasswordEmail;
