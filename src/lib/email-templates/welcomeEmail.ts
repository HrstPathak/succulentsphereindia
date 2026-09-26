import {
  BRAND,
  DEFAULT_SHOP_PATH,
  DEFAULT_SUPPORT_PHONE,
  FONT_SANS,
  FONT_SERIF,
  PANEL_WIDTH,
  PREHEADER_PAD,
  assetBaseUrl,
  assetUrl,
  cta,
  documentShell,
  escapeHtml,
  footer,
  origin,
  signature,
  trustStrip,
} from "./emailChrome";

/**
 * The welcome email — sent once, the moment a customer account is created.
 *
 * Why its own template rather than a variant of the confirmation: that message
 * opens on a dark green hero and leads with an order number, and every block in
 * it assumes a purchase exists. A welcome has neither. What it does share is
 * the chrome — shell, trust strip, signature, footer, CTA — which it imports
 * instead of restating, for the reason set out at the top of emailChrome.ts.
 *
 * Artwork
 * -------
 * The three photographs are hosted on the site CDN, and the template points at
 * those URLs by default so the message renders with no network plumbing (dry
 * runs, previews, layout probes).
 *
 * In production `src/lib/welcome-email.ts` replaces every `src` with a `cid:`
 * reference, and that is the whole point rather than a nicety. Gmail blocks
 * remote images by default and shows a grey placeholder until the reader clicks
 * "Display images". A welcome is the first thing a new customer ever hears from
 * this brand, and three grey boxes is not the introduction we want. The bytes
 * travel inside the MIME message instead, so they render unprompted.
 */

/**
 * Artwork source. `width`/`height` are the *displayed* box; the 2x re-encode
 * happens in welcome-email-assets.ts. Hard-coding both is what stops the layout
 * jumping while the image decodes.
 */
export const WELCOME_IMAGE_SOURCES = {
  hero: {
    url: "https://whitesmoke-cattle-754161.hostingersite.com/sites/images/HomePage/WelcomeEmailHero.webp",
    width: 620,
    height: 310,
    alt: "Three succulents in cream pots on a wooden table, lit by soft afternoon sun.",
  },
  /** The "What You Can Expect" panel, artwork and all. */
  mid: {
    url: "https://whitesmoke-cattle-754161.hostingersite.com/sites/images/HomePage/WelcomeEmailMidImage.webp",
    width: 620,
    height: 226,
    alt: "What you can expect: Premium Plants, Safe and Reliable Delivery, Expert Plant Care Tips, and A Greener Community.",
  },
  last: {
    url: "https://whitesmoke-cattle-754161.hostingersite.com/sites/images/HomePage/WelcomeEmailLastImage.webp",
    width: 620,
    height: 219,
    alt: "A single succulent in a marble pot on a round wooden table.",
  },
} as const;

/**
 * Known limitation of the supplied artwork, recorded here so it is not lost.
 *
 * WelcomeEmailMidImage.webp ships its heading, four pillar titles and four
 * bodies as pixels. The source is 2078px wide and renders at 620px — a 0.30x
 * reduction — which puts the pillar body copy near 9px, below the readable
 * floor for email and effectively illegible on a phone.
 *
 * It is still used as-is because it is the supplied design, and because it is a
 * decorative summary band rather than the message: the four pillars are
 * restated as live text in the plain-text twin, and the CTA, greeting and links
 * around it are all real markup. Rebuilding this one section as a table is the
 * fix if the copy ever has to be readable at phone size.
 */
export const WELCOME_MID_IMAGE_NOTE =
  "WelcomeEmailMidImage.webp bakes its heading and four pillars in as pixels. " +
  "2078px wide rendered at 620px is a 0.30x reduction, putting the body copy " +
  "near 9px. Used as supplied; rebuild as table markup if it must be read on a phone.";

export type WelcomeEmailInput = {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  /**
   * Overrides the artwork URLs. The orchestrator passes
   * `{hero:"cid:...", ...}` so the images are embedded rather than fetched.
   * Left empty, the hosted sources above are used.
   */
  images?: Partial<Record<keyof typeof WELCOME_IMAGE_SOURCES, string>>;
  assetBaseUrl?: string | null;
  siteUrl?: string | null;
  supportPhone?: string | null;
};

/**
 * Full-bleed artwork row.
 *
 * A plain <img>, not a `background-image` on the <td>. The confirmation's hero
 * has to be a background because it carries text on top of the photo, which
 * needs the VML <v:rect> fallback for Outlook. There is no text over this
 * artwork, so <img> is both simpler and better supported: Outlook honours the
 * `width` attribute directly, and a `cid:` source resolves from the MIME part
 * in every client that supports inline images at all.
 */
function imageRow(args: {
  src: string;
  width: number;
  height: number;
  alt: string;
  radius?: string;
}) {
  const radius = args.radius ? `border-radius:${args.radius};` : "";
  return `<tr>
            <td align="center" bgcolor="${BRAND.cream}" style="padding:0;background:${BRAND.cream};font-size:0;line-height:0">
              <img src="${escapeHtml(args.src)}" width="${args.width}" height="${args.height}" alt="${escapeHtml(args.alt)}" style="display:block;width:100%;max-width:${PANEL_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;font-size:0;line-height:0;${radius}" />
            </td>
          </tr>`;
}

/**
 * The "where to start" row: three links answering the questions a brand-new
 * account actually has.
 *
 * Three fixed-width cells rather than flexbox, and real <td>s rather than
 * inline-blocks, so Outlook lays this out without a hack. On a phone the cells
 * go full-width via `.ss-link`; Outlook ignores the media query and 620px is
 * comfortably wide enough for three columns.
 */
function startLinks(args: { links: Array<{ label: string; detail: string; url: string }> }) {
  const cells = args.links
    .map(
      (link) => `<td class="ss-link" width="33.33%" valign="top" style="width:33.33%;padding:0 7px">
            <a href="${escapeHtml(link.url)}" style="display:block;padding:16px 14px;background:${BRAND.panelSoft};border:1px solid ${BRAND.hairline};border-radius:10px;text-decoration:none">
              <div style="font-family:${FONT_SERIF};font-size:16px;line-height:1.3;color:${BRAND.ink}">${escapeHtml(link.label)}</div>
              <div style="padding-top:5px;font-family:${FONT_SANS};font-size:12.5px;line-height:1.5;color:${BRAND.muted}">${escapeHtml(link.detail)}</div>
            </a>
          </td>`,
    )
    .join("\n          <!--[if mso]></td><td><![endif]-->");

  return `<tr>
          <td class="ss-pad" style="padding:4px 34px 0">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
          ${cells}
              </tr>
            </table>
          </td>
        </tr>`;
}

/**
 * Per-template responsive rules. Indentation lines these up inside
 * documentShell's <style> block, as in the other two templates.
 */
const WELCOME_MEDIA_CSS = [
  "        .ss-pad { padding-left:22px !important; padding-right:22px !important; }",
  "        /* Three link cards across 375px would be ~110px each, which wraps the",
  "           labels to three lines. Stack them instead. */",
  "        .ss-link { display:block !important; width:100% !important; padding:0 0 10px !important; }",
  "        /* Swap the trust artwork for its text twin — see trustStrip(). */",
  "        .ss-trust-art { display:none !important; }",
  "        .ss-trust-text { display:block !important; }",
].join("\n");

export function buildWelcomeEmail(input: WelcomeEmailInput): {
  subject: string;
  preheader: string;
  html: string;
  text: string;
} {
  const firstName = String(input.firstName || "").trim();
  const lastName = String(input.lastName || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  // The greeting is the one place a wrong or missing name is actually
  // embarrassing, so an account without a first name gets "there", not "Hi ,".
  const name = firstName || "there";

  const base = assetBaseUrl(input.assetBaseUrl);
  const siteUrl = origin(input.siteUrl, "https://succulentsphere.com").replace(/\/+$/, "");
  const siteHost = siteUrl.replace(/^https?:\/\//, "");
  const phone = String(input.supportPhone || DEFAULT_SUPPORT_PHONE).trim();

  const shopUrl = `${siteUrl}${DEFAULT_SHOP_PATH}`;
  const careUrl = `${siteUrl}/plant-care`;
  const beginnerUrl = `${siteUrl}/collections/beginner-friendly`;
  const accountUrl = `${siteUrl}/account`;

  const images = WELCOME_IMAGE_SOURCES;
  const src = {
    hero: input.images?.hero || images.hero.url,
    mid: input.images?.mid || images.mid.url,
    last: input.images?.last || images.last.url,
  };

  const subject = fullName
    ? `Welcome to Succulent Sphere, ${fullName}`
    : "Welcome to Succulent Sphere";

  const preheader =
    "Your account is ready. Here is what to expect from us: handpicked " +
    "plants, careful delivery, and real plant-care help whenever you need it.";

  const html = documentShell({
    title: subject,
    mediaCss: WELCOME_MEDIA_CSS,
    preheaderHtml: `${escapeHtml(preheader)} ${PREHEADER_PAD}`,
    bodyHtml: `      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${PANEL_WIDTH}px;margin:0 auto;background:${BRAND.card};border-radius:16px">
        ${imageRow({
          src: src.hero,
          width: images.hero.width,
          height: images.hero.height,
          alt: images.hero.alt,
          radius: "16px 16px 0 0",
        })}
        <tr>
          <td class="ss-pad" style="padding:30px 34px 0">
            <p style="margin:0;font-family:${FONT_SERIF};font-size:21px;color:${BRAND.ink}">Hi ${escapeHtml(name)},</p>
            <h1 style="margin:14px 0 0;font-family:${FONT_SERIF};font-size:28px;line-height:1.2;color:${BRAND.ink};font-weight:normal;letter-spacing:-0.4px">Welcome to the family.</h1>
            <p style="margin:14px 0 0;font-family:${FONT_SANS};font-size:15px;line-height:1.65;color:${BRAND.body}">We are glad you found us. Succulent Sphere is a small studio of plant people. We grow, pack and ship every plant ourselves, and we would far rather help you keep one alive than sell you one you cannot.</p>
            <p style="margin:12px 0 0;font-family:${FONT_SANS};font-size:15px;line-height:1.65;color:${BRAND.body}">Your account is ready, so orders, addresses and order tracking are all one tap away whenever you need them.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 0 0">
            ${imageRow({
              src: src.mid,
              width: images.mid.width,
              height: images.mid.height,
              alt: images.mid.alt,
            })}
          </td>
        </tr>
        ${startLinks({
          links: [
            { label: "Start here", detail: "Plants that forgive a beginner.", url: beginnerUrl },
            { label: "Plant care", detail: "Plain-language guides for every plant we send.", url: careUrl },
            { label: "Your account", detail: "Orders, addresses and wishlist in one place.", url: accountUrl },
          ],
        })}
        <tr>
          <td class="ss-pad" style="padding:22px 34px 0" align="center">
            ${cta({
              label: "Explore all succulents",
              url: shopUrl,
              iconUrl: assetUrl(base, "icon-leaf-white.png"),
            })}
            <!-- Bare URL fallback, always present for text-only clients. -->
            <p style="margin:12px 0 0;font-family:${FONT_SANS};font-size:11.5px;line-height:1.6;color:#93A096;word-break:break-all">${escapeHtml(shopUrl)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 0 0">
            ${imageRow({
              src: src.last,
              width: images.last.width,
              height: images.last.height,
              alt: images.last.alt,
            })}
          </td>
        </tr>
        <tr>
          <td class="ss-pad" style="padding:26px 34px 4px">
            <p style="margin:0;font-family:${FONT_SERIF};font-size:17px;color:${BRAND.ink}">Thanks for joining us.</p>
            <p style="margin:8px 0 0;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:${BRAND.body}">If you ever need a hand, just reply to this email. A real person who grows plants will answer.</p>
          </td>
        </tr>
        ${trustStrip({ base })}
        ${signature({ base })}
        ${footer({
          orderNumber: "",
          phone,
          siteHost,
          reason: `You are receiving this because you created an account at ${escapeHtml(siteHost)}.`,
        })}
      </table>`,
  });

  return {
    subject,
    preheader,
    html,
    text: buildPlainText({ name, shopUrl, careUrl, beginnerUrl, accountUrl }),
  };
}

/**
 * Plain-text twin.
 *
 * Built from the same resolved URLs as the HTML so the two cannot drift, and
 * carrying the same three starting points: for a text-only reader those links
 * are the entire email, so collapsing them to a single shop URL would throw
 * away most of the message.
 *
 * The four "What You Can Expect" pillars are restated here as live text, which
 * doubles as the accessible copy for artwork that bakes them in as pixels.
 */
function buildPlainText(args: {
  name: string;
  shopUrl: string;
  careUrl: string;
  beginnerUrl: string;
  accountUrl: string;
}) {
  return `Hi ${args.name},

Welcome to the family.

We are glad you found us. Succulent Sphere is a small studio of plant people.
We grow, pack and ship every plant ourselves, and we would far rather help you
keep one alive than sell you one you cannot.

Your account is ready, so orders, addresses and order tracking are all one tap
away whenever you need them.

WHAT YOU CAN EXPECT
  Premium Plants            Handpicked, healthy succulents for your home and office.
  Safe & Reliable Delivery  Your plants will reach you fresh and on time, with great care.
  Expert Plant Care Tips    Easy guides and helpful advice to help your plants thrive.
  A Greener Community       Be part of a community that loves plants as much as you do.

WHERE TO START
  Start here:   ${args.beginnerUrl}
  Plant care:   ${args.careUrl}
  Your account: ${args.accountUrl}

Explore all succulents: ${args.shopUrl}

Thanks for joining us.

If you ever need a hand, just reply to this email. A real person who grows
plants will answer.

Happy Planting!
Succulent Sphere
`;
}

export default buildWelcomeEmail;


