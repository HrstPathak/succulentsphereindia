/**
 * Order confirmation email template (Succulent Sphere) — the message a
 * customer receives the moment an order is placed.
 *
 * Layout contract
 * ---------------
 * Reading order, top to bottom: wordmark, full-bleed light hero, the two
 * information cards (who ordered / how they are paying), the payment plan,
 * the items, the delivery address, the money summary, the call to action,
 * the trust strip, the wordmark again.
 *
 * The hero is the supplied OrderConfirmationImage, and it is the exact inverse
 * of the status email's hero in one respect that drives every decision here:
 * that one is a dark, low-key photo needing white copy over a heavy baked
 * scrim, and this one is a bright cream wall with a potted succulent on the
 * right and about 3:1 of flat empty wall on the left. Measured across that
 * empty field the darkest pixel is rgb(235,230,220) — 10.5:1 against BRAND.ink,
 * well past WCAG AAA. So the copy here is DARK ink on natural light, there is
 * no dark scrim, and the asset only gets a 12% cream veil as insurance against
 * a darker re-export. See scripts/build-email-assets.cjs.
 *
 * Because the copy column sits on the LEFT of that photo, the copy lives in its
 * own 330px table rather than in a full-width cell. A lone cell inside a
 * `width:100%` table is simply handed the whole row, so the width hint would be
 * ignored and the heading would run out across the succulent.
 *
 * Client-safety rules are inherited from the status template — tables with
 * `role="presentation"`, every meaningful colour repeated as a `bgcolor`, no
 * inline <svg>, hosted JPEG/PNG assets, a hidden preheader first in <body>.
 * Two are worth restating because this template leans on them harder:
 *   - The payment plan is nested tables rather than a flex row, so it survives
 *     the Word engine. It is the one block that must never render as a jumble:
 *     it tells a customer how much cash to hand the delivery agent.
 *   - Every <img> carries explicit width and height. Product thumbnails point
 *     at whatever host the catalogue uses and cannot be guaranteed, so they sit
 *     in fixed-size cells with alt="" — a 404 degrades to a tidy sage square,
 *     and the product name beside it is the accessible text.
 *
 * Shared chrome (wordmark, trust strip, support block, footer, tokens) comes
 * from ./emailChrome. The import is relative for the same reason it is in
 * orderStatus.ts: the preview tooling runs this file on plain node after tsc,
 * which emits path aliases verbatim.
 */

import {
  assetBaseUrl,
  assetUrl,
  BRAND,
  cta,
  DEFAULT_SUPPORT_PHONE,
  documentShell,
  escapeHtml,
  footer,
  FONT_SANS,
  FONT_SERIF,
  formatInr,
  money,
  PANEL_WIDTH,
  PREHEADER_PAD,
  signature,
  trustStrip,
} from "./emailChrome";

export type OrderConfirmationItem = {
  title?: string;
  quantity?: number;
  price?: string | number;
  image?: string;
  imageAlt?: string;
};

export type OrderConfirmationPaymentMode =
  | "prepaid"
  | "cod_deposit"
  | "cod"
  | "admin_test";

export type OrderConfirmationEmailInput = {
  orderId: string;
  orderNumber: number | string;
  customerName: string;
  customerEmail: string;
  items: OrderConfirmationItem[];
  /** Grand total charged for the order, including shipping and any COD fee. */
  total: number;
  paymentMode: OrderConfirmationPaymentMode;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  shipping?: number;
  discount?: number;
  codFee?: number;
  paymentReceived?: number;
  codDepositAmount?: number;
  codBalance?: number;
  walletAmountUsed?: number;
  cashbackEarned?: number;
  payableAmount?: number;
  assetBaseUrl?: string;
  shopUrl?: string;
  /** Where the "Track your order" button points. */
  accountUrl?: string;
  supportPhone?: string;
};

export type OrderConfirmationEmail = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

const DEFAULT_ACCOUNT_PATH = "/account/orders";

/** The measure of the hero's copy column, in CSS px. */
const HERO_COPY_WIDTH = 330;

/**
 * The <style> block both confirmation messages share.
 *
 * This used to be a literal array copy-pasted into each builder, which is the
 * precise failure mode the emailChrome header warns about: the two had already
 * drifted (only the customer copy carried the explanatory comments), and the
 * next person to add a rule would add it to one and forget the other. The
 * customer and admin emails are the same layout with different copy, so they
 * get the same phone behaviour by construction.
 *
 * Indentation is intentional — it lines up inside documentShell's <style>.
 */
const CONFIRMATION_MEDIA_CSS = [
  "        .ss-pad { padding-left:22px !important; padding-right:22px !important; }",
  "        .ss-hide-sm { display:none !important; }",
  "        .ss-hero { padding-left:24px !important; padding-right:24px !important; }",
  "        /* The copy is dark on a light photo, so on a phone it must stay on",
  "           the flat left half of the frame. Anchoring the crop left keeps",
  "           the heading and intro over empty wall; the succulent is cropped",
  "           out on narrow screens, which is the right trade for legibility. */",
  "        .ss-hero { background-position:0% center !important; }",
  "        .ss-hero-copy { display:block !important; width:100% !important; max-width:100% !important; }",
  "        /* Stack the two information cards. The mso ghost table keeps them",
  "           side by side in Outlook, which has no inline-block. */",
  "        .ss-card { display:block !important; max-width:100% !important; }",
  "        /* Four columns do not fit a 375px screen. The unit price is the one",
  "           that can go: quantity and line total still tell the story, and",
  "           the unit price is implied by the two. */",
  "        .ss-col-qty { display:none !important; }",
  "        /* The item row is thumbnail + title + line total, and the title is",
  "           the only elastic cell. Botanical names are long and mostly",
  "           unbreakable ('Pachyphytum oviferum' is a single ~140px word at",
  "           15.5px), so on a narrow phone the title's intrinsic width used to",
  "           win the column negotiation and squeeze the thumbnail out of the",
  "           row entirely. Two changes fix it: the chip is pinned so it can",
  "           never collapse, and the title is given a smaller measure and",
  "           allowed to break mid-word so it yields instead. */",
  "        .ss-thumb-cell { min-width:56px !important; width:56px !important; }",
  "        .ss-thumb-box { width:56px !important; height:56px !important; }",
  "        .ss-thumb-img { width:56px !important; height:56px !important; }",
  "        .ss-item-title { font-size:14px !important; overflow-wrap:break-word !important; word-break:break-word !important; }",
  "        .ss-item-total { font-size:13px !important; }",
  "        /* Swap the trust artwork for its text twin — see trustStrip(). */",
  "        .ss-trust-art { display:none !important; }",
  "        .ss-trust-text { display:block !important; }",
].join("\n");

/**
 * The resolved money story for one order.
 *
 * `paidNow` + `dueOnDelivery` always equals the order total, by construction
 * rather than by summing two independently-sourced fields. That matters: those
 * numbers come from three different writers in this codebase (the Razorpay
 * webhook, the COD session builder and the admin resend endpoint) and they do
 * not always populate the same fields. Deriving both from a single total —
 * `due` when it is a COD order, zero otherwise, and `paid` as whatever is left
 * — makes it structurally impossible for the email to contradict itself, and it
 * matches how getOrderPaymentSummary() and the Delhivery collectable amount are
 * already derived. An earlier version read `paymentReceived` and `codBalance`
 * independently and could print "paid ₹0" next to "due ₹724" on an order that
 * had been paid entirely from the wallet balance.
 */
type PaymentPlan = {
  mode: OrderConfirmationPaymentMode;
  isCod: boolean;
  isTest: boolean;
  total: number;
  shipping: number;
  discount: number;
  codFee: number;
  wallet: number;
  cashback: number;
  subtotal: number;
  /** Collected already: the advance deposit plus any wallet balance applied. */
  paidNow: number;
  /** The cash-on-delivery deposit taken up front (the ₹100 advance). */
  deposit: number;
  /** Still to be collected by the delivery agent. Zero for prepaid orders. */
  dueOnDelivery: number;
  /** Card headline, e.g. "Prepaid" or "Cash on Delivery". */
  label: string;
  /** One-line explanation for the hero. */
  hero: string;
  /** The line under the amount in the payment card. */
  cardLine: string;
  /** Longer form for the plan panel and the text part. */
  note: string;
  /** Row label in the money summary for money already collected. */
  paidRowLabel: string;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function resolvePaymentPlan(input: OrderConfirmationEmailInput): PaymentPlan {
  const total = money(input.total);
  const shipping = money(input.shipping);
  const discount = money(input.discount);
  const codFee = money(input.codFee);
  const wallet = money(input.walletAmountUsed);
  const cashback = money(input.cashbackEarned);
  const isTest = input.paymentMode === "admin_test";
  const isCodRequested =
    input.paymentMode === "cod_deposit" || input.paymentMode === "cod";

  // The advance is only ever a COD concept. For prepaid orders the field is
  // absent, and reading it would be harmless here but misleading in the copy.
  const deposit = isCodRequested
    ? money(input.codDepositAmount ?? input.paymentReceived)
    : 0;

  const dueOnDelivery = isCodRequested
    ? money(input.codBalance ?? Math.max(0, total - deposit - wallet))
    : 0;

  // A COD order with nothing left to collect is, everywhere else in this
  // codebase, reported as Prepaid: getOrderPaymentSummary() flips the mode and
  // the Delhivery collectable amount comes out zero. The email follows that,
  // because telling a customer to have cash ready for an amount nobody will
  // ask for is the kind of small wrongness that turns into a support call.
  const isCod = isCodRequested && dueOnDelivery > 0;

  // Single source of truth for the split. See the PaymentPlan comment.
  const paidNow = isTest
    ? 0
    : round2(Math.max(0, total - dueOnDelivery));

  // Reconstructed so the summary's lines add up to the total the customer was
  // quoted: total = subtotal + shipping + codFee - discount.
  const subtotal = Math.max(0, total + discount + shipping - codFee);

  const base = {
    mode: input.paymentMode,
    isCod,
    isTest,
    total,
    shipping,
    discount,
    codFee,
    wallet,
    cashback,
    subtotal,
    paidNow,
    deposit,
    dueOnDelivery,
  };

  if (isTest) {
    return {
      ...base,
      label: "Admin test order",
      hero:
        "This is an administrator-created test order. No payment was collected and no shipment will be booked.",
      cardLine: "No payment collected",
      note:
        "No payment was collected for this test order, so it will not be packed, dispatched or charged.",
      paidRowLabel: "Amount paid online",
    };
  }

  if (isCod) {
    const hasAdvance = paidNow > 0;
    return {
      ...base,
      label: "Cash on Delivery",
      hero: hasAdvance
        ? "Your order is confirmed and your advance has landed with us. Your plants are being prepared with care, and the balance is collected when they reach you."
        : "Your order is confirmed. Your plants are being prepared with care, and the full amount is collected when they reach you.",
      cardLine: hasAdvance
        ? `Advance received: ${formatInr(paidNow)}`
        : "Nothing paid yet",
      note: hasAdvance
        ? `We have already received ${formatInr(paidNow)} towards this order. Please keep ${formatInr(dueOnDelivery)} ready as cash for the delivery agent.`
        : `This order is Cash on Delivery. Please keep ${formatInr(dueOnDelivery)} ready as cash for the delivery agent.`,
      paidRowLabel: "Advance paid online",
    };
  }

  return {
    ...base,
    label: "Prepaid",
    hero:
      "We're so excited to bring a little more green into your space. Your order has been received, your payment is confirmed, and your plants are now being prepared with care.",
    cardLine: `Amount paid: ${formatInr(paidNow)}`,
    note: "Your payment was received successfully. Nothing further is due for this order.",
    paidRowLabel: "Amount paid online",
  };
}

/** Splits an address into readable, de-duplicated lines. */
function addressLines(input: OrderConfirmationEmailInput) {
  return [
    input.address,
    input.address2,
    input.city,
    input.state,
    input.pincode,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
}

/**
 * THE HERO BAND.
 *
 * The photo is declared the same three ways the status hero is — `background`
 * attribute, CSS `background-image` and a VML `<v:rect>` — because no single
 * one of them works everywhere, and the two templates have to degrade
 * identically or the same brand will look broken in one message and fine in
 * the other.
 *
 * The difference is the `bgcolor`: BRAND.trustCream rather than the dark
 * panel green. If a client supports none of the three background mechanisms the
 * reader gets a pale cream band, which is still a legible surface for dark
 * copy. A dark fallback would put ink-coloured text on a dark field and lose
 * the whole greeting.
 */
function heroPanel(args: {
  orderNumber: string;
  intro: string;
  heroUrl: string;
}) {
  const bg = escapeHtml(args.heroUrl);
  // The hero is now the first block in the message, so it owns the card's top
  // corners. Those used to live on the masthead, which no longer renders here:
  // without moving the radius the panel would open with square corners above a
  // photo, which reads as a bug even though nothing is actually misaligned.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${PANEL_WIDTH}px;margin:0 auto;background:${BRAND.trustCream};border-radius:16px 16px 0 0">
        <tr>
          <td class="ss-hero" width="${PANEL_WIDTH}" valign="top" bgcolor="${BRAND.trustCream}" background="${bg}" style="width:100%;max-width:${PANEL_WIDTH}px;background-color:${BRAND.trustCream};background-image:url('${bg}');background-size:cover;background-position:center center;background-repeat:no-repeat;padding:30px 34px 32px">
            <!--[if gte mso 9]>
            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" alt="A potted succulent ready to be packed and shipped" style="width:${PANEL_WIDTH}px;">
              <v:fill type="frame" src="${bg}" color="${BRAND.trustCream}" />
            </v:rect>
            <![endif]-->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="ss-hero-copy" width="${HERO_COPY_WIDTH}" style="width:${HERO_COPY_WIDTH}px">
              <tr>
                <td valign="top">
                  <div style="font-family:${FONT_SANS};font-size:10px;letter-spacing:3.4px;color:#7C8A7E;font-weight:bold">ORDER CONFIRMED</div>
                  <div style="padding:11px 0 0 0">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="44"><tr>
                      <td style="border-top:1px solid #C9C4B8;font-size:0">&nbsp;</td>
                    </tr></table>
                  </div>
                  <h1 style="margin:14px 0 0;font-family:${FONT_SERIF};font-size:30px;line-height:1.16;color:${BRAND.ink};font-weight:normal;letter-spacing:-0.4px">Thank you for your order!</h1>
                  <p style="margin:12px 0 0;padding:0;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:${BRAND.body}">${escapeHtml(args.intro)}</p>
                  <p style="margin:14px 0 0;padding:0;font-family:${FONT_SANS};font-size:14.5px;line-height:1.5;color:#6B7F70">Order <strong style="color:${BRAND.ink}">#${escapeHtml(args.orderNumber)}</strong></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
}

/**
 * The circular icon chip that leads every information block.
 *
 * The cell carries `height="44"` but a table cell's height attribute is a
 * MINIMUM, not a maximum: the cell is stretched to the height of its row, so
 * in a block whose text runs to four lines the chip came out 44x140 — a long
 * pale lozenge with the glyph stuck to the top of it. Wrapping the cell in its
 * own single-row table is what pins the height, because that inner table is
 * sized independently of the outer row. This is the same structure the status
 * template's disc() helper uses, for the same reason.
 */
function iconChip(args: {
  iconUrl: string;
  width: number;
  height: number;
  gap?: number;
}) {
  return `<td width="44" valign="top" style="width:44px;padding-right:${args.gap ?? 13}px">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="44" style="width:44px"><tr>
                    <td width="44" height="44" align="center" valign="middle" bgcolor="${BRAND.disc}" style="width:44px;height:44px;background:${BRAND.disc};border:1px solid ${BRAND.discBorder};border-radius:50%">
                      <img src="${escapeHtml(args.iconUrl)}" width="${args.width}" height="${args.height}" alt="" style="display:block;width:${args.width}px;height:${args.height}px;border:0;outline:none;text-decoration:none" />
                    </td>
                  </tr></table>
                </td>`;
}

/**
 * Renders a line of card text, letting a long email address wrap somewhere a
 * reader would choose.
 *
 * The customer card has roughly 170px of usable text width and a Gmail address
 * is around 180px at this size. With `word-break:break-word` and no break
 * opportunity anywhere in the string, the client breaks it wherever it runs out
 * of room — which rendered as "rosemariaofficial04@gmail.co" / "m". A
 * zero-width space after the "@" and after the final dot gives the client the
 * two places a reader would actually break the address themselves. The
 * character adds nothing when the address does fit, and a client that ignores
 * U+200B simply falls back to the old behaviour.
 */
function emailLine(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  // Escaped first so the zero-width spaces are inserted into already-safe text
  // and cannot interact with entity encoding.
  const wrapped = escapeHtml(trimmed)
    .replace(/@/g, "@\u200B")
    .replace(/\.(?=[^.]*$)/g, ".\u200B");
  return `<div style="padding-top:5px;font-family:${FONT_SANS};font-size:12px;line-height:1.5;color:#6B7F70;word-break:break-word">${wrapped}</div>`;
}

/**
 * ONE OF THE TWO INFORMATION CARDS.
 *
 * These sit side by side on a 620px panel, so they are `inline-block` for
 * webmail and wrapped in a ghost table for Outlook — Outlook has no
 * inline-block, and without the conditional the two cards would simply stack.
 * The ghost table is inert everywhere else: everything inside `<!--[if mso]>`
 * is a comment to a non-Outlook client.
 *
 * `max-width:48%` rather than 50%: inline-blocks are separated by the newline
 * between the tags, which renders as a ~4px space. 48 + 48 leaves room for that
 * gap inside the 552px content measure; at 50% the second card wraps onto its
 * own line in the widest inboxes.
 */
function infoCard(args: {
  label: string;
  iconUrl: string;
  iconW: number;
  iconH: number;
  title: string;
  /** Plain-text lines, escaped here. */
  lines: string[];
  /** The customer's address, rendered so it can wrap after the "@". */
  email?: string;
  /** Optional emphasised line, e.g. the amount due on delivery. */
  emphasis?: string;
}) {
  // The address belongs directly under the customer's name, so it is inserted
  // ahead of any plain lines rather than appended after them.
  const lines = (args.email ? [emailLine(args.email)] : [])
    .concat(
      args.lines
        .filter(Boolean)
        .map(
          (line) =>
            `<div style="padding-top:5px;font-family:${FONT_SANS};font-size:12px;line-height:1.5;color:#6B7F70;word-break:break-word">${escapeHtml(line)}</div>`,
        ),
    )
    .join("\n                  ");
  return `<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td width="50%" valign="top"><![endif]-->
            <div class="ss-card" style="display:inline-block;width:100%;max-width:48%;vertical-align:top;padding:16px 18px;background:${BRAND.panelSoft};border:1px solid ${BRAND.hairline};border-radius:14px;box-sizing:border-box">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                ${iconChip({ iconUrl: args.iconUrl, width: args.iconW, height: args.iconH })}
                <td valign="top">
                  <div style="font-family:${FONT_SANS};font-size:9.5px;letter-spacing:2.2px;color:#8A978C;font-weight:bold">${escapeHtml(args.label)}</div>
                  <div style="padding-top:5px;font-family:${FONT_SERIF};font-size:18px;line-height:1.25;color:${BRAND.ink}">${escapeHtml(args.title)}</div>
                  ${lines}
                  ${args.emphasis ? `<div style="padding-top:7px;font-family:${FONT_SANS};font-size:13px;line-height:1.4;color:${BRAND.codInkStrong};font-weight:bold">${escapeHtml(args.emphasis)}</div>` : ""}
                </td>
              </tr></table>
            </div>
            <!--[if mso]></td><td width="50%" valign="top"><![endif]-->`;
}

/**
 * THE PAYMENT PLAN — the partial-cash-on-delivery block.
 *
 * This is the reason the confirmation email cannot be a copy of the status
 * email. A ₹100 advance with the balance collected at the door is a genuinely
 * two-part payment, and the customer has to be able to answer two questions
 * from a glance: *how much have I already paid* and *how much cash do I need to
 * hand over*. So the two figures are set as large serif numerals side by side
 * rather than buried in a ledger, and the split is drawn as a proportional bar.
 *
 * The bar is two nested tables with percentage widths. It is deliberately not
 * an image: an image would have to be generated per order (one hosted file per
 * possible split, or a dynamic endpoint), and it could not carry the two
 * amounts as selectable text. Percentages on table cells are the one width unit
 * Outlook handles correctly, and a client that ignores them still gets the two
 * numerals, which is the part that actually matters.
 *
 * The bar is clamped to 6–94% so a ₹100-on-₹50 order (a stale balance from an
 * earlier edit) cannot render a sliver or a full block that contradicts the
 * numbers printed directly above it.
 */
function paymentPlanPanel(args: { plan: PaymentPlan }) {
  const { plan } = args;
  const ratio = plan.total > 0 ? plan.paidNow / plan.total : 0;
  const paidPct = Math.max(6, Math.min(94, Math.round(ratio * 100)));
  const duePct = 100 - paidPct;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 0;background:${BRAND.codBg};border:1px solid ${BRAND.codBorder};border-radius:14px">
        <tr>
          <td style="padding:20px 22px 18px">
            <div style="font-family:${FONT_SANS};font-size:9.5px;letter-spacing:2.4px;color:${BRAND.codInk};font-weight:bold">${plan.isTest ? "NO PAYMENT COLLECTED" : "CASH ON DELIVERY"}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:12px"><tr>
              <td width="50%" valign="top" align="left" style="width:50%">
                <div style="font-family:${FONT_SANS};font-size:9.5px;letter-spacing:1.6px;color:#A98A4E;font-weight:bold">PAID NOW</div>
                <div style="padding-top:4px;font-family:${FONT_SERIF};font-size:26px;line-height:1.1;color:${BRAND.ink}">${escapeHtml(formatInr(plan.paidNow))}</div>
              </td>
              <td width="50%" valign="top" align="right" style="width:50%;text-align:right">
                <div style="font-family:${FONT_SANS};font-size:9.5px;letter-spacing:1.6px;color:#A98A4E;font-weight:bold">DUE ON DELIVERY</div>
                <div style="padding-top:4px;font-family:${FONT_SERIF};font-size:26px;line-height:1.1;color:${BRAND.codInkStrong}">${escapeHtml(formatInr(plan.dueOnDelivery))}</div>
              </td>
            </tr></table>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px">
              <tr>
                <td width="${paidPct}%" height="8" bgcolor="${BRAND.panelDeep}" style="width:${paidPct}%;height:8px;background:${BRAND.panelDeep};font-size:0;line-height:0">&nbsp;</td>
                <td width="${duePct}%" height="8" bgcolor="#EADCC2" style="width:${duePct}%;height:8px;background:#EADCC2;font-size:0;line-height:0">&nbsp;</td>
              </tr>
            </table>

            <div style="padding-top:12px;font-family:${FONT_SANS};font-size:12.5px;line-height:1.6;color:${BRAND.codInk}">${escapeHtml(plan.note)}</div>
          </td>
        </tr>
      </table>`;
}

/**
 * A single line item.
 *
 * The thumbnail accepts a `cid:` reference as well as an https URL. The cid
 * form is what production uses: the bytes are attached to the message and
 * referenced as `cid:product-0`, so the image renders without the reader having
 * to click "Display images", which is the difference between a customer
 * recognising their plant and a grey box. A remote https URL is still honoured
 * for callers that have not prepared attachments yet.
 *
 * The cell is a fixed 64px with a `bgcolor` and a `border-radius`, so a blocked
 * or missing image degrades to a clean sage square instead of a torn row.
 * `alt=""` is deliberate: the product name is printed immediately to the right
 * of the image, so alt text would be a duplicate for screen readers — and if an
 * image fails to load, Outlook renders the alt text *inside* the 64px cell,
 * which shreds the layout.
 */
function itemRow(args: { item: OrderConfirmationItem }) {
  const { item } = args;
  const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
  const unit = money(item.price);
  const lineTotal = round2(unit * quantity);
  const title = String(item.title || "Plant").trim();
  const rawImage = String(item.image || "").trim();
  // Anything else — a data: URI, a relative path, a typo — is dropped, so the
  // row renders without a thumbnail rather than with one that can never load.
  const usable = /^(?:https?:\/\/|cid:)/i.test(rawImage) ? rawImage : "";

  // The chip carries its geometry three times over, deliberately: the `width`
  // attribute (Outlook's Word engine sizes the table from the attributes and
  // ignores <style>), the `min-width` + `width` on the cell, and the fixed
  // `width`/`height` on the image. `min-width` is the important one — without
  // it the chip is an ordinary elastic cell, and because the product title
  // beside it is mostly one long unbreakable botanical name, a narrow phone
  // would resolve the column contest in the title's favour and squeeze the
  // photo down to nothing. Pinning the minimum means the title yields first,
  // which is the correct priority: a wrapped four-line name is still readable,
  // a collapsed thumbnail is not.
  const thumb = usable
    ? `<td width="64" valign="top" class="ss-thumb-cell" style="width:64px;min-width:64px;padding-right:16px">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="64" class="ss-thumb-box" style="width:64px"><tr>
                    <td width="64" height="64" align="center" valign="middle" bgcolor="${BRAND.cream}" style="width:64px;height:64px;background:${BRAND.cream};border:1px solid ${BRAND.hairline};border-radius:12px">
                      <img src="${escapeHtml(usable)}" width="64" height="64" alt="" class="ss-thumb-img" style="display:block;width:64px;height:64px;max-width:100%;border:0;outline:none;text-decoration:none;border-radius:11px;object-fit:cover;object-position:center center" />
                    </td>
                  </tr></table>
                </td>`
    : "";

  return `<tr>
              <td valign="top" style="padding:14px 0;border-bottom:1px solid ${BRAND.hairline}">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                  ${thumb}
                  <td valign="middle" class="ss-item-title" style="font-family:${FONT_SERIF};font-size:15.5px;line-height:1.35;color:${BRAND.ink}">${escapeHtml(title)}</td>
                </tr></table>
              </td>
              <td valign="middle" align="center" class="ss-col-qty" width="52" style="width:52px;padding:14px 0;border-bottom:1px solid ${BRAND.hairline};font-family:${FONT_SANS};font-size:14px;color:${BRAND.body};text-align:center">${quantity}</td>
              <td valign="middle" align="right" class="ss-hide-sm" width="96" style="width:96px;padding:14px 0;border-bottom:1px solid ${BRAND.hairline};font-family:${FONT_SANS};font-size:14px;color:${BRAND.body};text-align:right">${escapeHtml(formatInr(unit))}</td>
              <td valign="middle" align="right" width="92" class="ss-item-total" style="width:92px;padding:14px 0;border-bottom:1px solid ${BRAND.hairline};font-family:${FONT_SANS};font-size:14px;font-weight:bold;color:${BRAND.ink};text-align:right;white-space:nowrap">${escapeHtml(formatInr(lineTotal))}</td>
            </tr>`;
}

/**
 * Items band: heading, column heads and one row per line item.
 *
 * This returns a COMPLETE, self-contained panel rather than a run of <tr>s to
 * be injected into the card table, and that is not a style preference — it is
 * the only thing that works.
 *
 * The card <table> is not actually a container for everything that looks like
 * it should be. The HTML5 parser has a rule nobody expects: a <table> start tag
 * appearing where a cell is expected implicitly closes the enclosing table
 * ("act as if </table> had been seen, then reprocess"). The blocks injected
 * after the greeting — paymentPlanPanel, deliveryBlock, orderSummary — each
 * return a complete <table>, so the card table is closed at the first of them
 * and everything after it is re-parented as a sibling of the card, straight
 * into the page background div. Measured in the browser, only 1 of the 3
 * `td.ss-pad` cells in the message actually existed in the DOM.
 *
 * The reason this stayed invisible for so long is that the escaping blocks each
 * carry their own background and border, so they still look like cards. The
 * items band was the one block with no background of its own, so it inherited
 * the page tone and rendered edge to edge — the heading, the thumbnail and the
 * TOTAL column all hard against the card border while every block above and
 * below was inset. Owning the background here makes the band correct whether
 * or not the surrounding table survived parsing.
 */
function itemsBand(args: { items: OrderConfirmationItem[] }) {
  const { items } = args;
  if (!items.length) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${PANEL_WIDTH}px;margin:0 auto;background:${BRAND.card}">
        <tr>
          <td class="ss-pad" style="padding:26px 34px 0">
            <div style="font-family:${FONT_SERIF};font-size:19px;color:${BRAND.ink}">Items ordered</div>
          </td>
        </tr>
      </table>`;
  }
  const count = items.length;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${PANEL_WIDTH}px;margin:0 auto;background:${BRAND.card}">
        <tr>
          <td class="ss-pad" style="padding:26px 34px 0">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td valign="middle" style="padding-bottom:12px;border-bottom:1px solid ${BRAND.hairline}">
            <div style="font-family:${FONT_SERIF};font-size:19px;color:${BRAND.ink}">Items ordered</div>
          </td>
          <td valign="middle" align="right" style="padding-bottom:12px;border-bottom:1px solid ${BRAND.hairline};font-family:${FONT_SANS};font-size:10px;letter-spacing:2px;color:#9AA79B;font-weight:bold;white-space:nowrap">${count} ${count === 1 ? "ITEM" : "ITEMS"}</td>
        </tr>
        <tr>
          <td style="padding:12px 0 6px;font-family:${FONT_SANS};font-size:9.5px;letter-spacing:1.8px;color:#9AA79B;font-weight:bold">PRODUCT</td>
          <td align="center" width="52" class="ss-col-qty" style="width:52px;padding:12px 0 6px;font-family:${FONT_SANS};font-size:9.5px;letter-spacing:1.8px;color:#9AA79B;font-weight:bold;text-align:center">QTY</td>
          <td align="right" width="96" class="ss-hide-sm" style="width:96px;padding:12px 0 6px;font-family:${FONT_SANS};font-size:9.5px;letter-spacing:1.8px;color:#9AA79B;font-weight:bold;text-align:right">UNIT PRICE</td>
          <td align="right" width="92" style="width:92px;padding:12px 0 6px;font-family:${FONT_SANS};font-size:9.5px;letter-spacing:1.8px;color:#9AA79B;font-weight:bold;text-align:right">TOTAL</td>
        </tr>
        ${items.map((item) => itemRow({ item })).join("\n        ")}
      </table>
          </td>
        </tr>
      </table>`;
}

/** One label/value row in the money summary. */
function summaryRow(args: {
  label: string;
  value: string;
  emphasis?: boolean;
  note?: string;
}) {
  return `<tr>
            <td style="padding:7px 0;font-family:${FONT_SANS};font-size:13.5px;line-height:1.5;color:${BRAND.body}">${escapeHtml(args.label)}${args.note ? `<span style="color:#98A49A"> &mdash; ${escapeHtml(args.note)}</span>` : ""}</td>
            <td align="right" style="padding:7px 0;font-family:${FONT_SANS};font-size:13.5px;line-height:1.5;color:${args.emphasis ? BRAND.ink : BRAND.body};font-weight:${args.emphasis ? "bold" : "normal"};text-align:right;white-space:nowrap">${escapeHtml(args.value)}</td>
          </tr>`;
}

/** Delivery address card. Omitted entirely when the order has no address. */
function deliveryBlock(args: {
  lines: string[];
  phone: string;
  iconUrl: string;
}) {
  if (!args.lines.length && !args.phone) return "";
  const text = args.lines
    .map((line) => escapeHtml(line))
    .join("<br />");
  const phone = args.phone
    ? `<div style="padding-top:6px;font-family:${FONT_SANS};font-size:13px;line-height:1.5;color:${BRAND.body}">${escapeHtml(args.phone)}</div>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:26px 0 0;background:${BRAND.panelSoft};border:1px solid ${BRAND.hairline};border-radius:14px">
        <tr>
          <td style="padding:18px 20px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              ${iconChip({ iconUrl: args.iconUrl, width: 21, height: 15, gap: 15 })}
              <td valign="top">
                <div style="font-family:${FONT_SANS};font-size:9.5px;letter-spacing:2.2px;color:#8A978C;font-weight:bold">DELIVERY ADDRESS</div>
                <div style="padding-top:7px;font-family:${FONT_SANS};font-size:13.5px;line-height:1.65;color:${BRAND.body}">${text}</div>
                ${phone}
              </td>
            </tr></table>
          </td>
        </tr>
      </table>`;
}

/**
 * The money summary.
 *
 * Zero-value rows are dropped rather than printed as "-₹0.00". A receipt that
 * lists "Discount -₹0.00" and "COD fee ₹0.00" teaches a customer nothing and
 * pushes the total — the only number they care about — off the bottom of a
 * phone screen.
 */
function orderSummary(args: { plan: PaymentPlan }) {
  const { plan } = args;
  const rows: string[] = [
    summaryRow({ label: "Subtotal", value: formatInr(plan.subtotal) }),
  ];
  if (plan.shipping > 0) {
    rows.push(summaryRow({ label: "Shipping", value: formatInr(plan.shipping) }));
  }
  if (plan.discount > 0) {
    rows.push(
      summaryRow({ label: "Discount", value: `-${formatInr(plan.discount)}` }),
    );
  }
  if (plan.wallet > 0) {
    rows.push(
      summaryRow({
        label: "Wallet used",
        note: "deducted from your wallet balance, not an extra discount",
        value: `-${formatInr(plan.wallet)}`,
      }),
    );
  }
  if (plan.codFee > 0) {
    rows.push(summaryRow({ label: "COD fee", value: formatInr(plan.codFee) }));
  }
  if (plan.cashback > 0) {
    rows.push(
      summaryRow({
        label: "Cashback credited",
        value: formatInr(plan.cashback),
      }),
    );
  }
  if (!plan.isTest) {
    rows.push(
      summaryRow({
        label: plan.paidRowLabel,
        value: formatInr(plan.paidNow),
      }),
    );
  }
  if (plan.isCod) {
    rows.push(
      summaryRow({
        label: "Payable on delivery",
        value: formatInr(plan.dueOnDelivery),
        emphasis: true,
      }),
    );
  }

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:26px 0 0;background:${BRAND.panelSoft};border:1px solid ${BRAND.hairline};border-radius:14px">
        <tr>
          <td style="padding:18px 20px 16px">
            <div style="font-family:${FONT_SERIF};font-size:19px;color:${BRAND.ink}">Order summary</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:10px">
              ${rows.join("\n              ")}
              <tr>
                <td style="padding:12px 0 0;border-top:1px solid #DCD6C9;font-family:${FONT_SERIF};font-size:17px;color:${BRAND.ink}">Total</td>
                <td align="right" style="padding:12px 0 0;border-top:1px solid #DCD6C9;font-family:${FONT_SERIF};font-size:19px;font-weight:bold;color:${BRAND.ink};text-align:right;white-space:nowrap">${escapeHtml(formatInr(plan.total))}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
}

/**
 * The "didn't get it" note.
 *
 * Kept in this email because it is the one with the highest chance of being
 * filed away unread: order confirmations get filtered harder than shipping
 * updates, and a customer who assumes the order was lost is a support ticket.
 * The lifecycle emails do not need it.
 */
function deliveryNotice() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 0;background:#FFFBF2;border:1px solid #F0E7CE;border-radius:12px">
        <tr>
          <td style="padding:16px 18px">
            <div style="font-family:${FONT_SANS};font-size:12.5px;font-weight:bold;color:#6B5220">Not in your inbox yet?</div>
            <div style="padding-top:5px;font-family:${FONT_SANS};font-size:12.5px;line-height:1.6;color:#6D5A33">Check your <strong>Spam</strong> or <strong>Junk</strong> folder and the Promotions tab. If it still isn't there, WhatsApp us on ${DEFAULT_SUPPORT_PHONE} with your order number and we'll resend it straight away.</div>
          </td>
        </tr>
      </table>`;
}

/**
 * The "COD fee / Shipping / Discount" strip under the payment amount.
 *
 * Returns nothing when all three are zero. Most orders are free delivery, no
 * COD fee and no discount, and a line reading "COD fee ₹0.00 · Shipping ₹0.00
 * · Discount ₹0.00" teaches the reader nothing while pushing the one line they
 * care about — the amount — down the card. Same reasoning as dropping zero rows
 * from the order summary.
 */
function feeStrip(plan: PaymentPlan) {
  const parts: string[] = [];
  if (plan.codFee > 0) parts.push(`COD fee ${formatInr(plan.codFee)}`);
  if (plan.shipping > 0) parts.push(`Shipping ${formatInr(plan.shipping)}`);
  if (plan.discount > 0) parts.push(`Discount ${formatInr(plan.discount)}`);
  if (plan.wallet > 0) parts.push(`Wallet ${formatInr(plan.wallet)}`);
  // A literal middot, not &bull;: this string is escaped by infoCard like any
  // other plain line, and an entity would come out as literal "&amp;bull;".
  return parts.length ? parts.join(" · ") : "";
}

/**
 * Builds the order confirmation email.
 *
 * Returns the subject, the preheader, the HTML part and a plain-text
 * alternative. The preheader carries the payment summary on purpose: it is the
 * only part of the message some inboxes will show before the customer opens
 * it, and "₹100 received, ₹624 due on delivery" is the single most useful
 * sentence this email contains.
 */
export function buildOrderConfirmationEmail(
  input: OrderConfirmationEmailInput,
): OrderConfirmationEmail {
  const plan = resolvePaymentPlan(input);
  const orderNumber = String(input.orderNumber ?? "").trim() || "-";
  const name = String(input.customerName || "").trim() || "there";
  const base = assetBaseUrl(input.assetBaseUrl);
  const siteHost = base.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const accountUrl = String(
    input.accountUrl || `${base}${DEFAULT_ACCOUNT_PATH}`,
  ).trim();
  const phone = String(input.supportPhone || DEFAULT_SUPPORT_PHONE).trim();
  const heroUrl = assetUrl(base, "hero-confirmation.jpg");

  const subject = `Order #${orderNumber} confirmed — Succulent Sphere`;
  const preheader = plan.isCod
    ? `${formatInr(plan.paidNow)} received. ${formatInr(plan.dueOnDelivery)} to pay when your plants arrive.`
    : plan.isTest
      ? "Administrator test order — no payment collected."
      : "Thank you! Your plants are being prepared with care.";

  // The phone goes on the customer card rather than only in the delivery
  // block: the delivery agent calls it before arriving, and having it beside
  // the customer's name is where a customer looks for it. It also balances the
  // two cards to the same height, since the payment card carries three lines.
  const customerCard = infoCard({
    label: "CUSTOMER",
    iconUrl: assetUrl(base, "icon-user.png"),
    iconW: 20,
    iconH: 20,
    title: name,
    // The address gets its own field so it can break after the "@"; the phone
    // number is an ordinary line.
    lines: [String(input.phone || "").trim()],
    email: String(input.customerEmail || ""),
  });

  const paymentCard = infoCard({
    label: "PAYMENT",
    iconUrl: assetUrl(base, "icon-card.png"),
    iconW: 20,
    iconH: 15,
    title: plan.label,
    lines: [plan.cardLine, feeStrip(plan)],
    emphasis: plan.isCod
      ? `Due on delivery: ${formatInr(plan.dueOnDelivery)}`
      : undefined,
  });

  const html = documentShell({
    title: subject,
    mediaCss: CONFIRMATION_MEDIA_CSS,
    preheaderHtml: `${escapeHtml(preheader)} ${PREHEADER_PAD}`,
    bodyHtml: `      ${heroPanel({ orderNumber, intro: plan.hero, heroUrl })}

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${PANEL_WIDTH}px;margin:0 auto;background:${BRAND.card}">
        <tr>
          <td class="ss-pad" style="padding:30px 34px 0">
            <p style="margin:0;font-family:${FONT_SERIF};font-size:21px;color:${BRAND.ink}">Hi ${escapeHtml(name)},</p>
            <p style="margin:14px 0 0;font-family:${FONT_SANS};font-size:15px;line-height:1.65;color:${BRAND.body}">${escapeHtml(plan.note)}</p>
            <div style="margin:22px 0 28px">
              ${customerCard}
              ${paymentCard}
              <!--[if mso]></td></tr></table><![endif]-->
            </div>
          </td>
        </tr>
        ${plan.isCod ? paymentPlanPanel({ plan }) : ""}
        ${itemsBand({ items: input.items || [] })}
        ${deliveryBlock({
          lines: addressLines(input),
          phone: String(input.phone || "").trim(),
          iconUrl: assetUrl(base, "icon-truck.png"),
        })}
        ${orderSummary({ plan })}
        <tr>
          <td class="ss-pad" style="padding:0 34px 4px">
            ${cta({
              label: "Track your order",
              url: accountUrl,
              iconUrl: assetUrl(base, "icon-truck-white.png"),
            })}
            <!-- Bare URL fallback, always present for text-only clients. -->
            <p style="margin:12px 0 0;font-family:${FONT_SANS};font-size:11.5px;line-height:1.6;color:#93A096;word-break:break-all">${escapeHtml(accountUrl)}</p>
            ${deliveryNotice()}
          </td>
        </tr>
        ${trustStrip({ base })}
        ${signature({ base })}
        ${footer({ orderNumber, phone, siteHost })}
      </table>`,
  });

  return { subject, preheader, html, text: buildPlainText(input, plan) };
}

/**
 * Plain-text alternative, built from the same resolved PaymentPlan as the HTML
 * so the two can never disagree.
 *
 * Roughly 40% of opens happen in clients that cannot render HTML at all, and
 * Gmail shows this part in its "View entire message" fallback. The payment
 * split is repeated verbatim here — a text-only reader needs the ₹100/₹624
 * split at least as much as a rich reader does.
 */
function buildPlainText(
  input: OrderConfirmationEmailInput,
  plan: PaymentPlan,
): string {
  const orderNumber = String(input.orderNumber ?? "").trim() || "-";
  const name = String(input.customerName || "").trim() || "there";
  const base = assetBaseUrl(input.assetBaseUrl);
  const siteHost = base.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const accountUrl = String(
    input.accountUrl || `${base}${DEFAULT_ACCOUNT_PATH}`,
  ).trim();
  const phone = String(input.supportPhone || DEFAULT_SUPPORT_PHONE).trim();

  const rule = "=".repeat(72);
  const thin = "-".repeat(72);
  const lines: string[] = [
    "Succulent Sphere",
    `Order #${orderNumber} confirmed`,
    rule,
    "",
    `Hi ${name},`,
    "",
    plan.note,
    "",
  ];

  if (plan.isCod) {
    lines.push(
      "CASH ON DELIVERY",
      thin,
      `  Paid now:            ${formatInr(plan.paidNow)}`,
      `  Due on delivery:     ${formatInr(plan.dueOnDelivery)}`,
      `  Order total:         ${formatInr(plan.total)}`,
      "",
    );
  }

  lines.push(`Payment: ${plan.label}`, `Customer: ${name}`);
  if (input.customerEmail) lines.push(`Email: ${input.customerEmail}`);
  if (input.phone) lines.push(`Phone: ${input.phone}`);

  const items = input.items || [];
  if (items.length) {
    lines.push("", `ITEMS (${items.length})`, thin);
    for (const item of items) {
      const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
      const unit = money(item.price);
      lines.push(
        `  ${quantity} x ${String(item.title || "Plant").trim()}` +
          `  @ ${formatInr(unit)}  = ${formatInr(round2(unit * quantity))}`,
      );
    }
  }

  const address = addressLines(input);
  if (address.length) {
    lines.push("", "DELIVERY ADDRESS", thin, ...address.map((l) => `  ${l}`));
  }

  lines.push("", "ORDER SUMMARY", thin, `  Subtotal: ${formatInr(plan.subtotal)}`);
  if (plan.shipping > 0) lines.push(`  Shipping: ${formatInr(plan.shipping)}`);
  if (plan.discount > 0) lines.push(`  Discount: -${formatInr(plan.discount)}`);
  if (plan.wallet > 0) lines.push(`  Wallet used: -${formatInr(plan.wallet)}`);
  if (plan.codFee > 0) lines.push(`  COD fee: ${formatInr(plan.codFee)}`);
  if (plan.cashback > 0) lines.push(`  Cashback: ${formatInr(plan.cashback)}`);
  if (!plan.isTest) lines.push(`  ${plan.paidRowLabel}: ${formatInr(plan.paidNow)}`);
  if (plan.isCod) {
    lines.push(`  Payable on delivery: ${formatInr(plan.dueOnDelivery)}`);
  }
  lines.push(`  TOTAL: ${formatInr(plan.total)}`);

  lines.push(
    "",
    `>> TRACK YOUR ORDER`,
    `   ${accountUrl}`,
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
 * The internal "new order" alert sent to ADMIN_EMAILS.
 *
 * This is the message that was previously the only branded email in the
 * system, and it is the plain design the customer-facing confirmation was
 * rebuilt away from. It now shares the same chrome and the same hardened
 * table structure, but keeps its own copy and its own purpose: an operator
 * wants the money and the fulfilment facts up front, not a thank-you, and the
 * primary action is "open this order", not "track it".
 *
 * The payment split is shown here too. The person packing the parcel is the
 * person the delivery agent will ask for cash from, and the amount the agent
 * collects is the amount the admin has to reconcile against.
 */
export function buildAdminOrderAlertEmail(
  input: OrderConfirmationEmailInput,
): OrderConfirmationEmail {
  const plan = resolvePaymentPlan(input);
  const orderNumber = String(input.orderNumber ?? "").trim() || "-";
  const base = assetBaseUrl(input.assetBaseUrl);
  const siteHost = base.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const phone = String(input.supportPhone || DEFAULT_SUPPORT_PHONE).trim();
  const heroUrl = assetUrl(base, "hero-confirmation.jpg");
  const adminLink = `${base}/admin/orders?q=${encodeURIComponent(orderNumber)}`;

  const subject = `New order #${orderNumber} — ${formatInr(plan.total)} — Succulent Sphere`;
  const preheader = plan.isCod
    ? `Collect ${formatInr(plan.dueOnDelivery)} on delivery; ${formatInr(plan.paidNow)} already received.`
    : `Paid in full. ${plan.isTest ? "Test order." : "Ready to pack."}`;

  const customerCard = infoCard({
    label: "CUSTOMER",
    iconUrl: assetUrl(base, "icon-user.png"),
    iconW: 20,
    iconH: 20,
    title: String(input.customerName || "Unknown customer").trim(),
    lines: [String(input.phone || "").trim()],
    email: String(input.customerEmail || ""),
  });

  const paymentCard = infoCard({
    label: "PAYMENT",
    iconUrl: assetUrl(base, "icon-card.png"),
    iconW: 20,
    iconH: 15,
    title: plan.label,
    lines: [plan.cardLine, feeStrip(plan)],
    emphasis: plan.isCod
      ? `Collect on delivery: ${formatInr(plan.dueOnDelivery)}`
      : undefined,
  });

  const html = documentShell({
    title: subject,
    mediaCss: CONFIRMATION_MEDIA_CSS,
    preheaderHtml: `${escapeHtml(preheader)} ${PREHEADER_PAD}`,
    bodyHtml: `      ${heroPanel({
        orderNumber,
        intro:
          "A fresh customer purchase has been received. Everything needed to pack and hand it over is below.",
        heroUrl,
      })}

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${PANEL_WIDTH}px;margin:0 auto;background:${BRAND.card}">
        <tr>
          <td class="ss-pad" style="padding:30px 34px 0">
            <div style="margin:0 0 28px">
              ${customerCard}
              ${paymentCard}
              <!--[if mso]></td></tr></table><![endif]-->
            </div>
          </td>
        </tr>
        ${plan.isCod ? paymentPlanPanel({ plan }) : ""}
        ${itemsBand({ items: input.items || [] })}
        ${deliveryBlock({
          lines: addressLines(input),
          phone: String(input.phone || "").trim(),
          iconUrl: assetUrl(base, "icon-truck.png"),
        })}
        ${orderSummary({ plan })}
        <tr>
          <td class="ss-pad" style="padding:0 34px 4px">
            ${cta({
              label: "Open in admin",
              url: adminLink,
              iconUrl: assetUrl(base, "icon-truck-white.png"),
            })}
            <p style="margin:12px 0 0;font-family:${FONT_SANS};font-size:11.5px;line-height:1.6;color:#93A096;word-break:break-all">${escapeHtml(adminLink)}</p>
          </td>
        </tr>
        ${trustStrip({ base })}
        ${signature({ base })}
        ${footer({ orderNumber, phone, siteHost })}
      </table>`,
  });

  return { subject, preheader, html, text: buildAdminPlainText(input, plan) };
}

function buildAdminPlainText(
  input: OrderConfirmationEmailInput,
  plan: PaymentPlan,
): string {
  const orderNumber = String(input.orderNumber ?? "").trim() || "-";
  const base = assetBaseUrl(input.assetBaseUrl);
  const siteHost = base.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const thin = "-".repeat(72);
  const lines: string[] = [
    "Succulent Sphere — NEW ORDER",
    `Order #${orderNumber}`,
    thin,
    "",
    `Payment mode: ${plan.label}`,
    `Amount paid: ${formatInr(plan.paidNow)}`,
  ];
  if (plan.isCod) {
    lines.push(`COLLECT ON DELIVERY: ${formatInr(plan.dueOnDelivery)}`);
  }
  lines.push(
    `Order total: ${formatInr(plan.total)}`,
    "",
    `Customer: ${String(input.customerName || "Unknown customer").trim()}`,
  );
  if (input.customerEmail) lines.push(`Email: ${input.customerEmail}`);
  if (input.phone) lines.push(`Phone: ${input.phone}`);
  const address = addressLines(input);
  if (address.length) lines.push("", "DELIVERY ADDRESS", ...address);

  const items = input.items || [];
  if (items.length) {
    lines.push("", "ITEMS", thin);
    for (const item of items) {
      const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
      const unit = money(item.price);
      lines.push(
        `  ${quantity} x ${String(item.title || "Plant").trim()}` +
          `  @ ${formatInr(unit)}  = ${formatInr(round2(unit * quantity))}`,
      );
    }
  }

  lines.push(
    "",
    ">> OPEN IN ADMIN",
    `   ${base}/admin/orders?q=${encodeURIComponent(orderNumber)}`,
    "",
    thin,
    "PLANTS - PEOPLE - A GREENER TOMORROW",
    siteHost,
  );
  return lines.join("\n");
}
