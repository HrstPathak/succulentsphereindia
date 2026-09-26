/**
 * Order status email template (Succulent Sphere).
 *
 * Layout contract — this is the approved design: the status panel is a
 * TWO COLUMN band with the copy on the LEFT and the product photo filling the
 * RIGHT column. It is deliberately built as nested tables with inline styles
 * because Outlook renders email through the Word engine, which ignores
 * flexbox, `border-radius`, `linear-gradient` and `object-fit`.
 *
 * Client-safety rules baked into every block below:
 *   - Tables + `role="presentation"`, never <div> layout.
 *   - Every colour that matters is repeated as a `bgcolor` attribute so
 *     Outlook (which drops `background-image`) still paints a solid panel.
 *   - The status pill and the CTA button sit on a solid `bgcolor` that matches
 *     their gradient, so a client without gradient support shows a filled
 *     button instead of white text on a white page.
 *   - Icons are hosted PNGs, not inline <svg>. Gmail strips inline SVG and
 *     Outlook desktop cannot render it at all. See scripts/build-email-assets.cjs.
 *   - The hero is a JPEG, not the source WebP: Outlook 2007-2021 and Windows
 *     Mail cannot decode WebP.
 *   - A hidden preheader is the first thing in <body> so the inbox snippet is
 *     never the wordmark.
 *   - The tracking panel is omitted for terminal states (delivered/cancelled)
 *     rather than rendered empty.
 */

export type OrderStatusEmailStatus =
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export type OrderStatusEmailInput = {
  status: OrderStatusEmailStatus;
  orderNumber: number | string;
  customerName?: string | null;
  /** Shown in the tracking panel and links to the carrier page. */
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  carrier?: string | null;
  /** Open cash-on-delivery balance, collected by the agent at the door. */
  amountDue?: number | null;
  /** Absolute origin that hosts /images/email assets. */
  assetBaseUrl?: string;
  shopUrl?: string;
  supportPhone?: string;
};

export type OrderStatusEmail = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

const BRAND = {
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
} as const;

const FONT_SERIF = "Georgia,'Times New Roman',serif";
const FONT_SANS = "Helvetica,Arial,sans-serif";

const DEFAULT_SITE_URL = "https://succulentsphere.com";
const DEFAULT_SHOP_PATH = "/collections/all-succulents";
const DEFAULT_SUPPORT_PHONE = "+91 94583 21209";

function escapeHtml(value: unknown) {
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
function origin(value: string | undefined | null, fallback: string) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return fallback;
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).origin;
  } catch {
    return fallback;
  }
}

type StatusCopy = {
  /** Pill text, e.g. IN-TRANSIT. */
  label: string;
  heading: string;
  subhead: string;
  intro: string;
  orderLine: string;
  detail: string;
  ctaLabel: string;
  /** Sentence appended to the order line, e.g. "is on its way". */
  ctaFallback: string;
  /** Two caption lines for the dynamic middle trust-strip badge. */
  badgeLines: [string, string];
  /** Filename in /images/email for the dynamic badge glyph. */
  badgeIcon: string;
  subject: string;
  preheader: string;
  heroAlt: string;
  /** Terminal states have nothing left to track, so the panel is dropped. */
  showsTracking: boolean;
  /** Cancelled uses a muted clay pill instead of the emerald brand gradient. */
  pill: string;
};

/**
 * The copy contract for all four lifecycle states. `sendOrderStatusEmail()`
 * keys off the same four values, so a status can never render a heading that
 * disagrees with its subject line.
 */
const STATUS_COPY: Record<OrderStatusEmailStatus, StatusCopy> = {
  IN_TRANSIT: {
    label: "IN-TRANSIT",
    heading: "Your plants have left our studio",
    subhead: "Packed with care. On their way to bring a little more green into your space.",
    intro: "Good news \u2014 your plants are on the move.",
    orderLine: "is on its way.",
    detail:
      "We have packed your plants carefully and handed them to the courier. They are now travelling to you.",
    ctaLabel: "Track your shipment",
    ctaFallback: "delhivery.com/track/package/",
    badgeLines: ["ON THE WAY", "TO YOU"],
    badgeIcon: "icon-truck.png",
    subject: "is on its way",
    preheader: "has left our studio \u2014 track your plants right here.",
    heroAlt: "A box of succulents packed and ready to ship",
    showsTracking: true,
    pill: BRAND.pill,
  },
  OUT_FOR_DELIVERY: {
    label: "OUT FOR DELIVERY",
    heading: "Your plants arrive today",
    subhead: "Out with the delivery agent. Keep your phone nearby.",
    intro: "Your plants are with the delivery agent.",
    orderLine: "is out for delivery.",
    detail:
      "The agent may call before arriving, and any cash on delivery amount is collected at the door.",
    ctaLabel: "Track your delivery",
    ctaFallback: "delhivery.com/track/package/",
    badgeLines: ["ARRIVING", "TODAY"],
    badgeIcon: "icon-van.png",
    subject: "is out for delivery",
    preheader: "is out for delivery today.",
    heroAlt: "A box of succulents packed and ready to ship",
    showsTracking: true,
    pill: BRAND.pill,
  },
  DELIVERED: {
    label: "DELIVERED",
    heading: "Your plants have arrived",
    subhead: "Delivered with care. Here is how to keep them thriving.",
    intro: "Your order has been delivered. We hope the plants bring you a lot of joy.",
    orderLine: "was delivered.",
    detail:
      "Place succulents in bright, indirect light and water them only when the soil is fully dry.",
    ctaLabel: "Shop more plants",
    ctaFallback: "succulentsphere.com",
    badgeLines: ["DELIVERED", "TO YOUR DOOR"],
    badgeIcon: "icon-check.png",
    subject: "was delivered",
    preheader: "has been delivered. Enjoy your plants!",
    heroAlt: "A box of succulents packed and ready to ship",
    showsTracking: false,
    pill: BRAND.pill,
  },
  CANCELLED: {
    label: "CANCELLED",
    heading: "Your order has been cancelled",
    subhead: "Sorry we could not send this one. Here is what happens next.",
    intro: "We are sorry \u2014 your order has been cancelled.",
    orderLine: "has been cancelled.",
    detail:
      "If you were charged online, the amount is released back to your original payment method and usually reflects in 5\u20137 business days.",
    ctaLabel: "Browse the collection",
    ctaFallback: "succulentsphere.com",
    badgeLines: ["REFUND", "ON ITS WAY"],
    badgeIcon: "icon-box.png",
    subject: "has been cancelled",
    preheader: "has been cancelled. Refund details inside.",
    heroAlt: "A box of succulents packed and ready to ship",
    showsTracking: false,
    pill: "#a3402f",
  },
};

/** Resolves a committed asset in /public/images/email to an absolute URL. */
function assetUrl(base: string, file: string) {
  return `${base}/images/email/${file}`;
}

/** Hidden filler so the inbox snippet is never padded out with the wordmark. */
const PREHEADER_PAD =
  "&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;" +
  "&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;" +
  "&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;";

/** Wordmark header. No drawn logo mark: the photo already carries the brand. */
function masthead() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;margin:0 auto;background:${BRAND.card};border-radius:16px 16px 0 0">
        <tr>
          <td style="padding:22px 30px 20px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
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

/** Tracking panel. Emitted only while a parcel is actually moving. */
function trackingPanel(args: { tracking: string; carrier: string }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 0;background:${BRAND.cream};border-radius:14px">
          <tr>
            <td style="padding:20px 22px">
              <div style="font-family:${FONT_SANS};font-size:9.5px;letter-spacing:2.4px;color:${BRAND.muted};font-weight:bold">TRACKING NUMBER</div>
              <div style="padding-top:7px;font-family:${FONT_SERIF};font-size:23px;line-height:1.2;color:${BRAND.ink};word-break:break-all">${escapeHtml(args.tracking)}</div>
              <div style="padding-top:7px;font-family:${FONT_SANS};font-size:12px;line-height:1.55;color:${BRAND.muted}">${escapeHtml(args.carrier)} &nbsp;&bull;&nbsp; first scans can take a few hours to appear</div>
            </td>
          </tr>
        </table>`;
}

/** Cash-on-delivery reminder, only when a balance is actually open. */
function dueNote(amount: number) {
  return `<p style="margin:20px 0 0;padding:16px;border-radius:12px;background:#fdf6ec;border:1px solid #f0e0c4;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:#7a5a1e">Please keep <strong style="color:#5c4212">&#8377;${escapeHtml(amount.toFixed(2))}</strong> ready for the delivery agent.</p>`;
}

/** CTA. Solid ${BRAND.button} under the gradient so Outlook gets a filled button. */
function cta(args: { label: string; url: string; iconUrl: string }) {
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


/** The tinted disc every trust-strip glyph sits in. Never white, so a blocked
 *  image degrades to a deliberate sage chip instead of an empty hole. */
function disc(iconUrl: string, width: number, height: number) {
  return `<td width="44" height="44" align="center" style="width:44px;height:44px;background:${BRAND.disc};border:1px solid ${BRAND.discBorder};border-radius:50%">
        <img src="${escapeHtml(iconUrl)}" width="${width}" height="${height}" alt="" style="display:block;width:${width}px;height:${height}px;border:0;outline:none;text-decoration:none" />
      </td>`;
}

function trustBadge(iconUrl: string, width: number, height: number, lines: [string, string]) {
  return `<td class="ss-badge" width="25%" align="center" valign="top" style="width:25%;padding:0 6px;text-align:center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto"><tr>
              ${disc(iconUrl, width, height)}
            </tr></table>
            <div style="padding-top:11px;font-family:${FONT_SANS};font-size:9px;letter-spacing:1.5px;line-height:1.75;color:#5C6E61;font-weight:bold">${lines[0]}<br>${lines[1]}</div>
          </td>`;
}

function rule() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="border-top:1px solid ${BRAND.hairline};font-size:0">&nbsp;</td>
          </tr></table>`;
}

/**
 * Builds the order status email for one lifecycle state.
 *
 * Returns the subject, the preheader, the HTML part and a plain-text
 * alternative. The text part is generated from the same STATUS_COPY entries as
 * the HTML, so the two can never drift apart the way a hand-maintained copy
 * would.
 */
export function buildOrderStatusEmail(input: OrderStatusEmailInput): OrderStatusEmail {
  const copy = STATUS_COPY[input.status] || STATUS_COPY.IN_TRANSIT;
  const orderNumber = String(input.orderNumber ?? "").trim() || "-";
  const name = String(input.customerName || "").trim() || "there";
  const base = origin(
    input.assetBaseUrl || process.env.ORDER_EMAIL_ASSET_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL,
    DEFAULT_SITE_URL,
  );
  const shopUrl = String(input.shopUrl || `${base}${DEFAULT_SHOP_PATH}`).trim();
  const tracking = String(input.trackingNumber || "").trim();
  const carrier = String(input.carrier || "Delhivery").trim();
  const phone = String(input.supportPhone || DEFAULT_SUPPORT_PHONE).trim();
  const heroUrl = assetUrl(base, "hero-email.jpg");
  const siteHost = base.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  // In-transit and out-for-delivery both point at the carrier page; the
  // terminal states point back into the shop instead.
  const ctaUrl = copy.showsTracking
    ? String(input.trackingUrl || (tracking ? `https://www.delhivery.com/track/package/${encodeURIComponent(tracking)}` : shopUrl))
    : shopUrl;

  const showTracking = copy.showsTracking && Boolean(tracking);
  const amountDue = Number(input.amountDue || 0);
  const subject = `Your Succulent Sphere order #${orderNumber} ${copy.subject}`;

  const html = `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
    <title>${escapeHtml(subject)}</title>
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
        .ss-pad { padding-left:22px !important; padding-right:22px !important; }
        .ss-hide-sm { display:none !important; }
        /* display:block is required, not just width:100%. A <td> is a table-cell,
           and two cells both asking for 100% makes the table layout algorithm
           hand the second one a computed width of 0 — the photo would vanish. */
        .ss-hero-text { display:block !important; width:100% !important; max-width:100% !important; }
        .ss-hero-img  { display:block !important; width:100% !important; max-width:100% !important; }
        .ss-hero-img img { width:100% !important; max-width:100% !important; height:auto !important; }
        /* 2x2 grid instead of a single 4-high column: keeps the strip from
           doubling the email's length on a phone. */
        .ss-badge { display:inline-block !important; width:50% !important; max-width:50% !important; padding:10px 6px !important; }
        .ss-vrule { display:none !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.page}">
    <!-- Preheader: the inbox snippet. Must be the first thing in the body. -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.page}">Order #${escapeHtml(orderNumber)} ${escapeHtml(copy.preheader)} ${PREHEADER_PAD}</div>

    <div style="background:${BRAND.page};padding:22px 12px 40px">
      ${masthead()}
      ${heroPanel({ copy, heroUrl, orderNumber })}

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;margin:0 auto;background:${BRAND.card}">
        <tr>
          <td class="ss-pad" style="padding:32px 34px 0">
            <p style="margin:0;font-family:${FONT_SERIF};font-size:21px;color:${BRAND.ink}">Hi ${escapeHtml(name)},</p>
            <p style="margin:16px 0 0;font-family:${FONT_SANS};font-size:15px;line-height:1.65;color:${BRAND.body}">${escapeHtml(copy.intro)}</p>
            <p style="margin:12px 0 0;font-family:${FONT_SANS};font-size:15px;line-height:1.65;color:${BRAND.body}">Order <strong style="color:${BRAND.ink}">#${escapeHtml(orderNumber)}</strong> ${escapeHtml(copy.orderLine)}</p>
            <p style="margin:12px 0 0;font-family:${FONT_SANS};font-size:15px;line-height:1.65;color:#6B7F70">${escapeHtml(copy.detail)}</p>
            ${showTracking ? trackingPanel({ tracking, carrier }) : ""}
            ${amountDue > 0 ? dueNote(amountDue) : ""}
            ${cta({ label: copy.ctaLabel, url: ctaUrl, iconUrl: assetUrl(base, "icon-truck-white.png") })}
            <!-- Bare URL fallback, always present for text-only clients. -->
            <p style="margin:12px 0 0;font-family:${FONT_SANS};font-size:11.5px;line-height:1.6;color:#93A096;word-break:break-all">${escapeHtml(ctaUrl)}</p>
          </td>
        </tr>
        ${trustStrip({ base, copy })}
        ${signature({ base })}
        ${footer({ orderNumber, phone, siteHost })}
      </table>
    </div>
  </body>
</html>`;

  return { subject, preheader: copy.preheader, html, text: buildPlainText(input, copy) };
}

/**
 * Plain-text alternative, built from the same STATUS_COPY entries as the HTML.
 *
 * Roughly 40% of opens happen in clients that cannot render HTML at all, and
 * Gmail shows the text part in its "View entire message" fallback. Deriving
 * both from one source means the two can never disagree.
 */
function buildPlainText(input: OrderStatusEmailInput, copy: StatusCopy): string {
  const orderNumber = String(input.orderNumber ?? "").trim() || "-";
  const name = String(input.customerName || "").trim() || "there";
  const base = origin(
    input.assetBaseUrl || process.env.ORDER_EMAIL_ASSET_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL,
    DEFAULT_SITE_URL,
  );
  const shopUrl = String(input.shopUrl || `${base}${DEFAULT_SHOP_PATH}`).trim();
  const tracking = String(input.trackingNumber || "").trim();
  const carrier = String(input.carrier || "Delhivery").trim();
  const phone = String(input.supportPhone || DEFAULT_SUPPORT_PHONE).trim();
  const siteHost = base.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  const ctaUrl = copy.showsTracking
    ? String(
        input.trackingUrl ||
          (tracking ? `https://www.delhivery.com/track/package/${encodeURIComponent(tracking)}` : shopUrl),
      )
    : shopUrl;

  const rule = "=".repeat(72);
  const thin = "-".repeat(72);
  const lines: string[] = [
    "Succulent Sphere",
    `Order update - ${copy.label}`,
    rule,
    "",
    `Hi ${name},`,
    "",
    copy.intro,
    "",
    `Order #${orderNumber} ${copy.orderLine}`,
    "",
    copy.detail,
    "",
  ];

  // Terminal states have nothing left to track, so the block is omitted
  // rather than printed with an empty number.
  if (copy.showsTracking && tracking) {
    lines.push("TRACKING NUMBER", `${tracking}  (${carrier})`, "");
  }

  const amountDue = Number(input.amountDue || 0);
  if (amountDue > 0) {
    lines.push(
      `Please keep Rs.${amountDue.toFixed(2)} ready for the delivery agent.`,
      "",
    );
  }

  lines.push(
    `>> ${copy.ctaLabel.toUpperCase()}`,
    `   ${ctaUrl}`,
    "",
    thin,
    `CAREFULLY PACKED  |  ${copy.badgeLines.join(" ")}  |  SAFE & SECURE DELIVERY`,
    "BRINGING NATURE CLOSER",
    thin,
    "",
    "Questions? Reply to this email and our plant team will help.",
    "",
    "Happy Planting!",
    "",
    thin,
    "PLANTS - PEOPLE - A GREENER TOMORROW",
    `${siteHost} | ${phone}`,
    "",
    `You are receiving this because you placed order #${orderNumber} with us.`,
  );

  return lines.join("\n");
}

function trustStrip(args: { base: string; copy: StatusCopy }) {
  const { base, copy } = args;
  const vrule = `<td class="ss-vrule" width="1" style="width:1px;background:${BRAND.divider};font-size:0">&nbsp;</td>`;
  return `<tr>
            <td style="padding:30px 22px 0">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.cream};border-radius:14px">
                <tr>
                  <td style="padding:22px 8px">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        ${trustBadge(assetUrl(base, "icon-leaf.png"), 20, 20, ["CAREFULLY", "PACKED"])}
                        ${vrule}
                        ${trustBadge(assetUrl(base, copy.badgeIcon), 20, 20, copy.badgeLines)}
                        ${vrule}
                        ${trustBadge(assetUrl(base, "icon-shield.png"), 19, 19, ["SAFE &amp; SECURE", "DELIVERY"])}
                        ${vrule}
                        ${trustBadge(assetUrl(base, "icon-sprout.png"), 20, 20, ["BRINGING NATURE", "CLOSER"])}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function signature(args: { base: string }) {
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

function footer(args: { orderNumber: string; phone: string; siteHost: string }) {
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

/**
 * THE HEADLINE BLOCK — copy on the left, product photo on the right.
 *
 * Two sibling <td>s inside one <tr>. The left cell carries the eyebrow, the
 * status pill, the heading and the subhead; the right cell holds the hero and
 * bleeds to the right edge of the card. Fixed pixel widths are set on both
 * cells (and repeated as `width` attributes) because Outlook ignores
 * `max-width` and would otherwise let the photo eat the whole row.
 *
 * The panel background is repeated as `bgcolor` so Outlook — which drops
 * `background-image` — still paints solid forest green behind the text.
 */
function heroPanel(args: {
  copy: StatusCopy;
  heroUrl: string;
  orderNumber: string;
}) {
  const { copy, heroUrl, orderNumber } = args;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;margin:0 auto;background:${BRAND.panelDeep}">
        <tr>
          <td class="ss-hero-text" width="372" valign="top" bgcolor="${BRAND.panel}" style="width:372px;background-color:${BRAND.panel};background-image:linear-gradient(160deg,${BRAND.panelLight} 0%,${BRAND.panel} 45%,${BRAND.panelDeep} 100%);padding:32px 24px 34px 34px">
            <div style="font-family:${FONT_SANS};font-size:10px;letter-spacing:3.4px;color:${BRAND.panelEyebrow};font-weight:bold">ORDER UPDATE</div>
            <div style="padding:12px 0 20px 0">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="44"><tr>
                <td style="border-top:1px solid ${BRAND.panelRule};font-size:0">&nbsp;</td>
              </tr></table>
            </div>

            <!-- STATUS PILL. Solid ${BRAND.pill} under the brand gradient so Outlook
                 and no-gradient clients get a filled emerald chip, not white text
                 on a white page. -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" bgcolor="${copy.pill}" style="background-color:${copy.pill};background-image:linear-gradient(135deg,#0a8f6a 0%,#12b981 55%,#0a8f6a 100%);border-radius:999px">
                  <div style="padding:12px 22px 13px;font-family:${FONT_SANS};font-size:19px;line-height:1;font-weight:bold;letter-spacing:3px;color:#FFFFFF">${escapeHtml(copy.label)}</div>
                </td>
              </tr>
            </table>

            <h1 style="margin:20px 0 0;font-family:${FONT_SERIF};font-size:29px;line-height:1.18;color:#FFFFFF;font-weight:normal">${escapeHtml(copy.heading)}</h1>
            <p style="margin:13px 0 0;padding:0;font-family:${FONT_SANS};font-size:14.5px;line-height:1.62;color:${BRAND.panelText}">${escapeHtml(copy.subhead)}</p>
          </td>

          <!-- HERO COLUMN. The forest colour sits behind the photo so a blocked
               image leaves a clean green block, and alt text still reads.
               The cell is 248px wide and the photo is 248x334, which matches the
               rendered height of the copy beside it, so the panel reads as one
               solid band instead of a photo floating above dead space. -->
          <td class="ss-hero-img" width="248" valign="top" bgcolor="${BRAND.panelDeep}" style="width:248px;background-color:${BRAND.panelDeep};font-size:0;line-height:0">
            <img src="${escapeHtml(heroUrl)}" width="248" height="334" alt="${escapeHtml(copy.heroAlt)}" style="display:block;width:100%;max-width:248px;height:auto;border:0;outline:none;text-decoration:none" />
          </td>
        </tr>
      </table>`;
}
