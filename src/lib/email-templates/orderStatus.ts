/**
 * Order status email template (Succulent Sphere).
 *
 * Layout contract — this is the approved design: the status panel is a
 * FULL-BLEED band with the photo painted as its background and the copy
 * layered on top, followed by a full-bleed trust strip image. It is
 * deliberately built as nested tables with inline styles because Outlook
 * renders email through the Word engine, which ignores flexbox,
 * `border-radius`, `linear-gradient` and `object-fit`.
 *
 * Client-safety rules baked into every block below:
 *   - Tables + `role="presentation"`, never <div> layout.
 *   - Every colour that matters is repeated as a `bgcolor` attribute so
 *     Outlook (which drops `background-image`) still paints a solid panel.
 *   - The status panel sets its photo THREE ways — the `background` attribute,
 *     a CSS `background-image`, and a VML `<v:rect>` — because each covers a
 *     different set of clients and no single one is universal. The darkening
 *     gradient that keeps white copy legible over the photo is BAKED INTO the
 *     JPEG (see scripts/build-email-assets.cjs): email cannot reliably stack a
 *     translucent layer above a background image.
 *   - The status pill and the CTA button sit on a solid `bgcolor` that matches
 *     their gradient, so a client without gradient support shows a filled
 *     button instead of white text on a white page.
 *   - Icons are hosted PNGs, not inline <svg>. Gmail strips inline SVG and
 *     Outlook desktop cannot render it at all. See scripts/build-email-assets.cjs.
 *   - The hero and the trust strip are JPEG, not the source WebP/PNG: Outlook
 *     2007-2021 and Windows Mail cannot decode WebP, and the strip is a
 *     mostly-flat cream field that mozjpeg compresses far smaller.
 *   - A hidden preheader is the first thing in <body> so the inbox snippet is
 *     never the wordmark.
 *   - The tracking panel is omitted for terminal states (delivered/cancelled)
 *     rather than rendered empty.
 *
 * Everything this template shares with the order confirmation template — the
 * wordmark, trust strip, support block, footer, colour tokens and document
 * shell — lives in ./emailChrome.ts. Only the status-specific parts (the four
 * state copy entries, the dark hero panel, the tracking panel and the cash
 * reminder) are declared here.
 *
 * The import is relative rather than "@/lib/..." on purpose: email-preview/verify.cjs
 * and shoot.cjs run this file on plain node after `tsc` has emitted it, and tsc
 * resolves a path alias for type-checking but emits the specifier verbatim, so
 * an aliased import compiles to a require("@/lib/...") that node cannot load.
 * A relative specifier survives the emit. This matches the sibling imports
 * already used in src/lib (./orderAmounts, ./huggingface).
 */

import {
  assetBaseUrl,
  assetUrl,
  BRAND,
  cta,
  DEFAULT_SHOP_PATH,
  DEFAULT_SUPPORT_PHONE,
  disc,
  documentShell,
  escapeHtml,
  footer,
  FONT_SANS,
  FONT_SERIF,
  masthead,
  PREHEADER_PAD,
  rule,
  signature,
  trustStrip,
  PANEL_WIDTH,
} from "./emailChrome";

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
    subject: "has been cancelled",
    preheader: "has been cancelled. Refund details inside.",
    heroAlt: "A box of succulents packed and ready to ship",
    showsTracking: false,
    pill: "#a3402f",
  },
};

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
  const base = assetBaseUrl(input.assetBaseUrl);
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

  const html = documentShell({
    title: subject,
    mediaCss: [
      "        .ss-pad { padding-left:22px !important; padding-right:22px !important; }",
      "        .ss-hide-sm { display:none !important; }",
      "        .ss-hero { padding-left:24px !important; padding-right:24px !important; }",
      "        /* The photo is baked dark across its whole width so white copy stays",
      "           legible, and on a phone the copy spans the full panel. Anchoring the",
      "           crop to the left keeps the heading and subhead over the flat end of",
      "           the gradient rather than the succulent box. */",
      "        .ss-hero { background-position:0% center !important; }",
      "        .ss-hero-copy { display:block !important; width:100% !important; max-width:100% !important; }",
      "        /* Swap the trust artwork for its text twin — see trustStrip(). */",
      "        .ss-trust-art { display:none !important; }",
      "        .ss-trust-text { display:block !important; }",
    ].join("\n"),
    preheaderHtml: `Order #${escapeHtml(orderNumber)} ${escapeHtml(copy.preheader)} ${PREHEADER_PAD}`,
    bodyHtml: `      ${masthead()}
      ${heroPanel({ copy, heroUrl })}

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${PANEL_WIDTH}px;margin:0 auto;background:${BRAND.card}">
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
        ${trustStrip({ base })}
        ${signature({ base })}
        ${footer({ orderNumber, phone, siteHost })}
      </table>`,
  });

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
  const base = assetBaseUrl(input.assetBaseUrl);
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
    "CAREFULLY PACKED  |  SAFE & SECURE DELIVERY  |  BRINGING NATURE CLOSER",
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

/**
 * THE HEADLINE BLOCK — the product photo fills the entire panel and the status
 * copy sits on top of it.
 *
 * This is a background image, and email has no single attribute that works
 * everywhere, so the photo is declared three ways:
 *   1. `background` attribute  — honoured by Outlook 2007+ and Gmail, but
 *      repeats the image as a tile rather than scaling it.
 *   2. CSS `background-image` with `background-size:cover` — correct scaling
 *      in Apple Mail, iOS, Samsung and most webmail clients.
 *   3. A VML `<v:rect>` inside `<!--[if gte mso 9]>` — `type="frame"` stretches
 *      the photo to the cell, which is the only way to get a non-repeating
 *      background into Outlook desktop.
 * `bgcolor` repeats the panel colour underneath all three, so a client that
 * supports none of them still shows the intended solid green block.
 *
 * The copy sits in its own 320px-wide table rather than in a full-width cell
 * with a `width` hint. A lone cell inside a `width:100%` table is simply handed
 * the whole row, so the hint is ignored and the subhead runs out across the
 * succulent box; sizing the table is what actually holds the measure.
 */
function heroPanel(args: {
  copy: StatusCopy;
  heroUrl: string;
}) {
  const { copy, heroUrl } = args;
  const bg = escapeHtml(heroUrl);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;margin:0 auto;background:${BRAND.panelDeep}">
        <tr>
          <td class="ss-hero" width="620" valign="top" bgcolor="${BRAND.panelDeep}" background="${bg}" style="width:100%;max-width:620px;background-color:${BRAND.panelDeep};background-image:url('${bg}');background-size:cover;background-position:center center;background-repeat:no-repeat;padding:34px 30px 36px">
            <!--[if gte mso 9]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" alt="${escapeHtml(copy.heroAlt)}" style="width:620px;">
              <v:fill type="frame" src="${bg}" color="${BRAND.panelDeep}" />
            </v:rect>
            <![endif]-->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="ss-hero-copy" width="320" style="width:320px">
              <tr>
                <td valign="top">
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
                  <p style="margin:13px 0 0;padding:0;font-family:${FONT_SANS};font-size:14.5px;line-height:1.62;color:#EAF2EC">${escapeHtml(copy.subhead)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
}
