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
  /**
   * The dark footer band (brandFooter).
   *
   * `footerBg` is `panelDeep` rather than a new green, so the band is provably
   * the same colour as the CTA button. `footerRule` and `footerRing` are solid
   * hexes instead of `rgba(255,255,255,.22)` because Outlook's Word engine
   * drops alpha and would render a transparent hairline — or, worse, a
   * transparent border around each social chip.
   */
  footerInk: "#FFFFFF",
  footerMuted: "#AEC0B3",
  footerFaint: "#8AA093",
  footerRule: "#5A7466",
  footerRing: "#8FAE97",
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
 * This was the supplied EmailFooter artwork rendered as one image, and it is
 * now three live claims. The change was forced by two faults in that artwork,
 * both of which were already documented on the dark band below (see
 * brandFooter) and both of which this block had to not inherit:
 *
 *   1. It printed "SAFE & SECURE DELIVERY" twice. The truck and the shield were
 *      both captioned with the same line, so two of the four columns said the
 *      same thing while the plain-text part of the same email said only three
 *      claims — the image and the text contradicted each other.
 *   2. Its captions are baked at a 0.30x reduction. Scaled into a 375px
 *      viewport they land near 5px and are unreadable on a phone. The old
 *      markup worked around this with a media query that swapped the image for
 *      a text twin, which left the desktop and phone versions as two
 *      hand-maintained copies of the same three claims.
 *
 * Live text fixes both at once: the captions cannot duplicate, cannot be
 * re-scaled into illegibility, and the rendered claims are generated from one
 * TRUST_CLAIMS table, so the strip and the plain-text part cannot drift apart.
 *
 * The tradeoff the single-image design bought — one hosted URL instead of
 * three, and immunity to a client that drops a subset of <img> tags — is
 * weaker than it looks. A blocked strip cost all three captions; here a dropped
 * glyph costs only the glyph, because every claim keeps its caption as text.
 * That is the same structure brandFooter() already ships in the welcome email.
 *
 * The columns use the same fixed-width geometry as that band: the dividers sit
 * in their own 2% columns and the claims share the rest, so the widest caption
 * cannot set the width for the others and unbalance the row.
 *
 * Glyph widths are per-claim because the set is deliberately mixed: the truck
 * is a wide 21x15 mark while the leaf and sprout are 17x17 and 18x18, and
 * pinning them all to one square would distort the truck.
 */
const TRUST_CLAIMS = [
  { label: "Carefully Packed", icon: "icon-leaf.png", w: 17, h: 17 },
  { label: "Safe & Secure Delivery", icon: "icon-truck.png", w: 21, h: 15 },
  { label: "Bringing Nature Closer", icon: "icon-sprout.png", w: 18, h: 18 },
];

export function trustStrip(args: { base: string }) {
  // 3 claims x 32% + 2 dividers x 2% = 100%.
  const claimWidth = 32;
  const cells = TRUST_CLAIMS.map((claim, index) => {
    const divider =
      index === 0
        ? ""
        : `<td width="2%" valign="top" style="width:2%;font-size:0;line-height:0">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td align="center" valign="top" height="40" style="height:40px;font-size:0;line-height:0">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="1" align="center"><tr>
                  <td width="1" height="40" bgcolor="${BRAND.hairline}" style="width:1px;height:40px;background:${BRAND.hairline};font-size:0;line-height:0">&nbsp;</td>
                </tr></table>
              </td>
            </tr></table>
          </td>`;
    return `${divider}<td width="${claimWidth}%" valign="top" align="center" style="width:${claimWidth}%;padding:0 4px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td align="center" style="padding:0 0 9px;font-size:0;line-height:0">
                <img src="${escapeHtml(assetUrl(args.base, claim.icon))}" width="${claim.w}" height="${claim.h}" alt="" style="display:block;width:${claim.w}px;height:${claim.h}px;border:0;outline:none;text-decoration:none" />
              </td>
            </tr>
            <tr>
              <td align="center" style="font-family:${FONT_SANS};font-size:10px;line-height:1.5;letter-spacing:0.6px;font-weight:bold;color:${BRAND.panelLight}">${escapeHtml(claim.label.toUpperCase())}</td>
            </tr></table>
          </td>`;
  }).join("\n                ");

  return `<tr>
            <td class="ss-trust" width="${PANEL_WIDTH}" bgcolor="${BRAND.trustCream}" style="width:100%;padding:0;background:${BRAND.trustCream}">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout:fixed"><tr>
                <td style="padding:22px 18px 20px">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout:fixed"><tr>
                ${cells}
                  </tr></table>
                </td>
              </tr></table>
            </td>
          </tr>`;
}

/**
 * The same claims as the strip, as one plain-text line.
 *
 * Derived from TRUST_CLAIMS rather than typed out, so the strip and the text
 * part of the same email can never disagree about what the store promises —
 * which is exactly how the shipped artwork came to print one claim twice while
 * the text beside it listed three.
 */
export function trustClaimsLine() {
  return TRUST_CLAIMS.map((claim) => claim.label.toUpperCase()).join("  |  ");
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

export function footer(args: {
  orderNumber: string;
  phone: string;
  siteHost: string;
  /**
   * Why this person is receiving the message. Defaults to the order line the
   * transactional templates want; a non-order email (the welcome) passes its
   * own so the footer never claims an order that does not exist.
   */
  reason?: string;
}) {
  const reason =
    args.reason ??
    `You are receiving this because you placed order #${escapeHtml(args.orderNumber)} with us.`;
  return `<tr>
            <td align="center" style="padding:26px 34px 30px;background:#FAF9F5;border-top:1px solid ${BRAND.hairline}">
              <div style="font-family:${FONT_SERIF};font-size:19px;color:${BRAND.ink}">Succulent Sphere</div>
              <div style="padding-top:7px;font-family:${FONT_SANS};font-size:9px;letter-spacing:2.8px;color:#9AA79B">PLANTS &nbsp;&bull;&nbsp; PEOPLE &nbsp;&bull;&nbsp; A GREENER TOMORROW</div>
              <div style="padding-top:16px;font-family:${FONT_SANS};font-size:11px;line-height:1.7;color:#A8B3A9">
                ${escapeHtml(args.siteHost)} &nbsp;&bull;&nbsp; ${escapeHtml(args.phone)}<br>
                ${reason}
              </div>
            </td>
          </tr>`;
}

/**
 * THE DARK FOOTER BAND.
 *
 * The welcome design closes on a full-bleed dark green band — four trust
 * claims with white glyphs, a hairline, a follow row, then the small print.
 * That is a different component from the cream `footer()` above rather than a
 * restyling of it, so the transactional templates keep the footer they ship
 * and this one is added beside it.
 *
 * Live HTML, not one exported JPEG like footer-email.jpg, and the reason is
 * that image's two documented faults are exactly the faults this band must not
 * inherit. Its captions are baked in at a 0.30x reduction and are illegible on
 * a phone, and it prints "SAFE & SECURE DELIVERY" twice — the truck and the
 * shield were both captioned with the same line. Real text cannot be
 * mis-cropped, cannot be re-scaled into illegibility, and lets the follow row
 * be actual links.
 *
 * The claims row is `table-layout:fixed` with the three dividers in their own
 * 2% columns and the claims at 23.5% each (4 x 23.5 + 3 x 2 = 100). Letting
 * the content size them instead lets the widest caption, "Safe & Reliable
 * Delivery", set the width for all four and visibly unbalances the row.
 *
 * Glyph sizes are per-claim because the set is deliberately mixed: the truck
 * is a wide 21x15 mark while the shield and heart are 18x18, and pinning them
 * all to one square would distort the truck.
 */
export function brandFooter(args: {
  claims: Array<{ label: string; iconUrl: string; iconWidth: number; iconHeight: number }>;
  social: Array<{ label: string; url: string; iconUrl: string }>;
  siteUrl: string;
  siteHost: string;
  phone: string;
  /** Why this person is receiving the message. Escaped here, so pass raw text. */
  reason: string;
}) {
  const dividers = args.claims
    .map((claim, index) => {
      const divider =
        index === 0
          ? ""
          : `<td width="2%" valign="top" style="width:2%;font-size:0;line-height:0">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                      <td align="center" valign="top" height="46" style="height:46px;font-size:0;line-height:0">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="1" align="center"><tr>
                          <td width="1" height="46" bgcolor="${BRAND.footerRule}" style="width:1px;height:46px;background:${BRAND.footerRule};font-size:0;line-height:0">&nbsp;</td>
                        </tr></table>
                      </td>
                    </tr></table>
                  </td>`;
      return `${divider}<td width="23.5%" valign="top" align="center" style="width:23.5%;padding:0 3px">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                      <td align="center" style="padding:0 0 9px;font-size:0;line-height:0">
                        <img src="${escapeHtml(claim.iconUrl)}" width="${claim.iconWidth}" height="${claim.iconHeight}" alt="" style="display:block;width:${claim.iconWidth}px;height:${claim.iconHeight}px;border:0;outline:none;text-decoration:none" />
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="font-family:${FONT_SANS};font-size:10px;line-height:1.5;letter-spacing:0.3px;font-weight:bold;color:${BRAND.footerInk}">${escapeHtml(claim.label)}</td>
                    </tr></table>
                  </td>`;
    })
    .join("\n                  ");
  /**
   * Social chips.
   *
   * Two details are load-bearing and both were found by measuring the render
   * rather than by reading the markup, because each still *looks* correct in
   * the source:
   *
   * 1. `border-collapse:separate` on the chip's own table. The document-level
   *    `table { border-collapse:collapse }` in the head otherwise wins, and
   *    under collapsing borders Chrome drops `border-radius` on the cell
   *    entirely — the chips rendered as rounded rectangles at every viewport.
   * 2. The wrapping table is 36px wide while the cell is 34px. The cell is
   *    content-box, so its 1px border is outside the 34px and makes it 36px
   *    overall; at `width="34"` the table squeezed the cell to 33px and it
   *    stopped being square, so `50%` resolved to an ellipse.
   */
  const socials = args.social
    .map(
      (link) => `<td align="center" valign="top" style="padding:0 7px">
                    <a href="${escapeHtml(link.url)}" style="display:inline-block;text-decoration:none">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="36" align="center" style="border-collapse:separate"><tr>
                        <td width="34" height="34" align="center" valign="middle" bgcolor="${BRAND.panelDeep}" style="width:34px;height:34px;background:${BRAND.panelDeep};border:1px solid ${BRAND.footerRing};border-radius:50%">
                          <img src="${escapeHtml(link.iconUrl)}" width="16" height="16" alt="${escapeHtml(link.label)}" style="display:block;width:16px;height:16px;border:0;outline:none;text-decoration:none" />
                        </td>
                      </tr></table>
                    </a>
                  </td>`,
    )
    .join("\n                  ");

  return `<tr>
            <td align="center" bgcolor="${BRAND.panelDeep}" style="padding:30px 26px 28px;background:${BRAND.panelDeep};border-radius:0 0 16px 16px">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout:fixed">
                <tr>${dividers}</tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td style="padding:24px 0 0;font-size:0;line-height:0">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                    <td style="border-top:1px solid ${BRAND.footerRule};font-size:0">&nbsp;</td>
                  </tr></table>
                </td>
              </tr></table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td align="center" style="padding:22px 0 0">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${socials}</tr></table>
                </td>
              </tr></table>
              <div style="padding-top:22px;font-family:${FONT_SANS};font-size:10.5px;line-height:1.7;color:${BRAND.footerMuted}">
                <a href="${escapeHtml(args.siteUrl)}" style="color:${BRAND.footerMuted};text-decoration:underline">${escapeHtml(args.siteHost)}</a>
                &nbsp;&bull;&nbsp; ${escapeHtml(args.phone)}
              </div>
              <div style="padding-top:7px;font-family:${FONT_SANS};font-size:9.5px;line-height:1.7;color:${BRAND.footerFaint}">
                ${escapeHtml(args.reason)}
              </div>
            </td>
          </tr>`;
}

/** CTA. Solid BRAND.button under the gradient so Outlook gets a filled button. */
/**
 * The pill button.
 *
 * `iconWidth`/`iconHeight` default to the truck's 21x15, which is what every
 * transactional call site wants. A call site with a different glyph must state
 * its own dimensions rather than have them pinned here: the markup below
 * hardcodes the box, so rendering an 18x18 shield into 21x15 would stretch it.
 */
export function cta(args: {
  label: string;
  url: string;
  iconUrl: string;
  iconWidth?: number;
  iconHeight?: number;
}) {
  const iconWidth = args.iconWidth || 21;
  const iconHeight = args.iconHeight || 15;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0">
          <tr>
            <td align="center" bgcolor="${BRAND.button}" style="background-color:${BRAND.button};background-image:linear-gradient(180deg,${BRAND.panel} 0%,${BRAND.button} 100%);border-radius:999px">
              <a href="${escapeHtml(args.url)}" style="display:inline-block;padding:15px 28px;font-family:${FONT_SANS};font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:999px">
                <img src="${escapeHtml(args.iconUrl)}" width="${iconWidth}" height="${iconHeight}" alt="" style="vertical-align:-3px;padding-right:11px;border-right:1px solid rgba(255,255,255,.34);margin-right:12px" />${escapeHtml(args.label)}&nbsp; <span style="padding-left:2px">&#8594;</span>
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

