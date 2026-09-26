/**
 * Shared chrome for every Succulent Sphere transactional email.
 *
 * Why this module exists
 * ----------------------
 * The order status template and the order confirmation template are two
 * different messages, but they open and close identically: same wordmark, same
 * trust strip, same support block, same footer, same colour tokens, same
 * fonts, same asset host. When those lived inside orderStatus.ts the
 * confirmation email had no choice but to fork them, and forked email chrome
 * drifts within a release or two (a footer that gains a line in one template
 * and not the other is exactly the kind of thing nobody notices until a
 * customer does). So the chrome is declared once here and both templates
 * import it.
 *
 * The client-safety rules below are inherited from the status template and are
 * the reason this is deliberately table-based and inline-styled rather than
 * flexbox and a stylesheet:
 *   - Tables + `role="presentation"`, never <div> layout. Outlook renders
 *     email through the Word engine, which ignores flexbox, `border-radius`,
 *     `linear-gradient`, `object-fit` and <style>.
 *   - Every colour that matters is repeated as a `bgcolor` attribute so a
 *     client that drops `background-image` still paints a solid panel.
 *   - Icons are hosted PNGs, not inline <svg>. Gmail strips inline SVG
 *     outright and Outlook desktop cannot draw it at all.
 *   - A hidden preheader is the first thing in <body> so the inbox snippet is
 *     never the wordmark.
 */

/**
 * Brand tokens. `ink` on the cream/page tones is the only combination used for
 * body copy and it clears WCAG AAA (7:1) everywhere in both templates; the
 * `panel*` family is the dark green used for the status hero and the buttons.
 */
export const BRAND = {
  ink: "#20352A",
  body: "#3B4B40",
  muted: "#7C8A7E",
  page: "#F7F5F1",
  card: "#FFFFFF",
  cream: "#F5F3EF",
  hairline: "#EDE9E1",
  panel: "#3E5B48",
  panelDeep: "#2F4D3F",
  panelLight: "#4A6A55",
  panelText: "#DCE7DE",
  panelEyebrow: "#C8D8C9",
  panelRule: "#8FAE97",
  /** Add to Cart gradient, flattened to a single colour for Outlook. */
  pill: "#0a8f6a",
  button: "#2F4D3F",
  disc: "#EEF1E9",
  discBorder: "#DFE4D8",
  divider: "#E0DCD2",
  /**
   * Background of the supplied trust-strip artwork. The strip is rendered
   * full-bleed, so its own cream is painted on the row too: any rounding
   * between the image edge and the row would otherwise show as a seam.
   */
  trustCream: "#F8F8F3",
  /**
   * The warm off-white used for the confirmation template's information cards
   * and the items band. Deliberately a shade off `card`: a pure white card on
   * a white page has no visible edge in clients that drop `border-radius`, and
   * the reference design reads as flat panels rather than floating cards.
   */
  panelSoft: "#F7F6F1",
  /** The cash-on-delivery reminder tint, warm enough to read as "attention". */
  codBg: "#FDF6EC",
  codBorder: "#F0E0C4",
  codInk: "#7A5A1E",
  codInkStrong: "#5C4212",
} as const;

export const FONT_SERIF = "Georgia,'Times New Roman',serif";
export const FONT_SANS = "Helvetica,Arial,sans-serif";

export const DEFAULT_SITE_URL = "https://succulentsphere.com";
export const DEFAULT_SHOP_PATH = "/collections/all-succulents";
export const DEFAULT_SUPPORT_PHONE = "+91 94583 21209";

/** Every panel in both templates is this wide; the assets are baked at 2x. */
export const PANEL_WIDTH = 620;

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
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

/** Normalises an env-supplied origin, falling back to the production domain. */
export function origin(value: string | undefined | null, fallback: string) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return fallback;
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).origin;
  } catch {
    return fallback;
  }
}

/**
 * Resolves the origin that hosts /public/images/email.
 *
 * ORDER_EMAIL_ASSET_BASE_URL exists so the email assets can be moved to a
 * dedicated image host without touching code; NEXT_PUBLIC_SITE_URL is the
 * normal case because Vercel serves /public at the apex.
 */
export function assetBaseUrl(explicit?: string | null) {
  return origin(
    explicit ||
      process.env.ORDER_EMAIL_ASSET_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL,
    DEFAULT_SITE_URL,
  );
}

/** Resolves a committed asset in /public/images/email to an absolute URL. */
export function assetUrl(base: string, file: string) {
  return `${base}/images/email/${file}`;
}

/** Hidden filler so the inbox snippet is never padded out with the wordmark. */
export const PREHEADER_PAD =
  "&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;" +
  "&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;" +
  "&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;";

/**
 * Wraps body markup in a complete, valid HTML document.
 *
 * The <style> block is progressive enhancement ONLY. Outlook ignores it
 * entirely and several webmail clients strip it, so every rule must have an
 * inline equivalent — the media query below is the sole exception, and it only
 * ever *hides* or *widens* things that already look acceptable without it.
 * `mediaCss` is per-template because each one has its own hero behaviour.
 */
export function documentShell(args: {
  title: string;
  mediaCss: string;
  preheaderHtml: string;
  bodyHtml: string;
}) {
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
    <title>${escapeHtml(args.title)}</title>
    <!--[if mso]>
    <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
    <![endif]-->
    <style>
      /* Progressive enhancement only. Outlook ignores <style>; every rule here
         has an inline equivalent, so a client that drops this block still
         renders the intended layout. */
      body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
      table { border-collapse:collapse; }
      img { border:0; outline:none; text-decoration:none; }
      a { color:inherit; }
      @media only screen and (max-width:620px) {
${args.mediaCss}
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.page}">
    <!-- Preheader: the inbox snippet. Must be the first thing in the body. -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.page}">${args.preheaderHtml}</div>

    <div style="background:${BRAND.page};padding:22px 12px 40px">
${args.bodyHtml}
    </div>
  </body>
</html>`;
}

/**
 * Wordmark header.
 *
 * `logoUrl` is optional on purpose. The status template passes nothing: its
 * hero photo is dark and a drawn mark would sit on the white card directly
 * above that photo, where it competes with it rather than framing it. The
 * confirmation template passes the rosette because its masthead is
 * white-on-cream with a wide empty right-hand side, which is exactly where the
 * drawn mark earns its place.
 */
export function masthead(args?: { logoUrl?: string }) {
  const mark = args?.logoUrl
    ? `<td width="60" valign="middle" style="width:60px;padding-right:16px">
              <img src="${escapeHtml(args.logoUrl)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border:0;outline:none;text-decoration:none" />
            </td>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${PANEL_WIDTH}px;margin:0 auto;background:${BRAND.card};border-radius:16px 16px 0 0">
        <tr>
          <td style="padding:22px 30px 20px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              ${mark}
              <td valign="middle">
                <div style="font-family:${FONT_SERIF};font-size:22px;line-height:1.1;color:${BRAND.ink}">Succulent Sphere</div>
                <div style="padding-top:5px;font-family:${FONT_SANS};font-size:9.5px;letter-spacing:2.6px;color:${BRAND.muted}">SMALL PLANTS. BIG JOY.</div>
              </td>
              <td align="right" valign="middle" class="ss-hide-sm" style="font-family:${FONT_SANS};font-size:9px;letter-spacing:1.9px;color:#9AA79B;line-height:1.9">
                SUCCULENTS<br>&bull;&nbsp; INDOOR PLANTS<br>&bull;&nbsp; PLANT DECOR
              </td>
            </tr></table>
          </td>
        </tr>
      </table>`;
}

export function rule() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="border-top:1px solid ${BRAND.hairline};font-size:0">&nbsp;</td>
          </tr></table>`;
}

/**
 * The tinted disc behind a support or info glyph. Never white, so a blocked
 * image degrades to a deliberate sage chip instead of an empty hole.
 */
export function disc(iconUrl: string, width: number, height: number) {
  return `<td width="44" height="44" align="center" style="width:44px;height:44px;background:${BRAND.disc};border:1px solid ${BRAND.discBorder};border-radius:50%">
        <img src="${escapeHtml(iconUrl)}" width="${width}" height="${height}" alt="" style="display:block;width:${width}px;height:${height}px;border:0;outline:none;text-decoration:none" />
      </td>`;
}

/**
 * Full-bleed trust strip.
 *
 * This is the supplied EmailFooter artwork rendered as one image rather than
 * four inline glyphs plus captions. One hosted file instead of four is both
 * lighter to send and immune to a client that drops a subset of the <img> tags
 * — an earlier build lost every badge in exactly that way.
 *
 * The strip carries its own cream background, so the row is painted the same
 * cream (`BRAND.trustCream`) to hide any rounding at the image edge, and the
 * image spans the full panel with no side padding. The alt text carries the
 * badge wording for blocked-image and screen-reader users.
 */
export function trustStrip(args: { base: string }) {
  return `<tr>
            <td class="ss-trust" width="${PANEL_WIDTH}" bgcolor="${BRAND.trustCream}" style="width:100%;padding:0;background:${BRAND.trustCream}">
              <!-- DESKTOP: the supplied artwork, full-bleed. -->
              <div class="ss-trust-art" style="display:block;font-size:0;line-height:0">
                <img src="${escapeHtml(assetUrl(args.base, "footer-email.jpg"))}" width="${PANEL_WIDTH}" height="116" alt="Carefully packed, safe and secure delivery, bringing nature closer" style="display:block;width:100%;max-width:${PANEL_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none" />
              </div>
              <!-- PHONE: the same three claims as live text. The artwork is
                   drawn for a 620px panel, so scaled into a 375px viewport its
                   captions land near 5px and are unreadable. Real text cannot
                   404, cannot be re-scaled into illegibility, and needs no
                   icon files. -->
              <div class="ss-trust-text" style="display:none;padding:20px 22px;font-family:${FONT_SANS};font-size:10px;letter-spacing:1.6px;line-height:2.2;color:${BRAND.panelLight};font-weight:bold;text-align:center">
                CAREFULLY PACKED &nbsp;&bull;&nbsp; SAFE &amp; SECURE DELIVERY &nbsp;&bull;&nbsp; BRINGING NATURE CLOSER
              </div>
            </td>
          </tr>`;
}

export function signature(args: { base: string }) {
  return `<tr>
            <td style="padding:28px 34px 30px">
              ${rule()}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px"><tr>
                <td width="46" valign="middle" style="width:46px">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                    ${disc(assetUrl(args.base, "icon-chat.png"), 19, 19)}
                  </tr></table>
                </td>
                <td valign="middle" style="padding-left:15px">
                  <div style="font-family:${FONT_SERIF};font-size:17px;color:${BRAND.ink}">Questions?</div>
                  <div style="padding-top:4px;font-family:${FONT_SANS};font-size:12.5px;line-height:1.55;color:${BRAND.muted}">Reply to this email and our plant team will help.</div>
                </td>
                <td align="right" valign="middle" class="ss-hide-sm" style="width:150px">
                  <!-- Serif italic rather than a script font: script faces are
                       missing on most Android and Windows mail clients and would
                       silently fall back to a random default. -->
                  <div style="font-family:${FONT_SERIF};font-style:italic;font-size:19px;line-height:1.25;color:${BRAND.panel}">Happy<br>Planting!</div>
                  <div style="padding-top:2px;text-align:right;font-size:14px;color:${BRAND.panel}">&#9825;</div>
                </td>
              </tr></table>
            </td>
          </tr>`;
}

export function footer(args: { orderNumber: string; phone: string; siteHost: string }) {
  return `<tr>
            <td align="center" style="padding:26px 34px 30px;background:#FAF9F5;border-top:1px solid ${BRAND.hairline}">
              <div style="font-family:${FONT_SERIF};font-size:19px;color:${BRAND.ink}">Succulent Sphere</div>
              <div style="padding-top:7px;font-family:${FONT_SANS};font-size:9px;letter-spacing:2.8px;color:#9AA79B">PLANTS &nbsp;&bull;&nbsp; PEOPLE &nbsp;&bull;&nbsp; A GREENER TOMORROW</div>
              <div style="padding-top:16px;font-family:${FONT_SANS};font-size:11px;line-height:1.7;color:#A8B3A9">
                ${escapeHtml(args.siteHost)} &nbsp;&bull;&nbsp; ${escapeHtml(args.phone)}<br>
                You are receiving this because you placed order #${escapeHtml(args.orderNumber)} with us.
              </div>
            </td>
          </tr>`;
}

/** CTA. Solid BRAND.button under the gradient so Outlook gets a filled button. */
export function cta(args: { label: string; url: string; iconUrl: string }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0">
          <tr>
            <td align="center" bgcolor="${BRAND.button}" style="background-color:${BRAND.button};background-image:linear-gradient(180deg,${BRAND.panel} 0%,${BRAND.button} 100%);border-radius:999px">
              <a href="${escapeHtml(args.url)}" style="display:inline-block;padding:15px 28px;font-family:${FONT_SANS};font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:999px">
                <img src="${escapeHtml(args.iconUrl)}" width="21" height="15" alt="" style="vertical-align:-3px;padding-right:11px;border-right:1px solid rgba(255,255,255,.34);margin-right:12px" />${escapeHtml(args.label)}&nbsp; <span style="padding-left:2px">&#8594;</span>
              </a>
            </td>
          </tr>
        </table>`;
}

/** Formats a rupee amount the way every block in both templates prints it. */
export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Positive, finite money. Anything else collapses to 0 so a malformed Firestore
 * value can never print "NaN" or "-Infinity" in a customer's inbox.
 */
export function money(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

