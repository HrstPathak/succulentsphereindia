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
  brandFooter,
  cta,
  documentShell,
  escapeHtml,
  origin,
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
 *
 * The type is stated rather than inferred because `as const` alone is not
 * enough here: it would make each slot an exact object type, and a slot that
 * omits `coverPosition` would then not have that property at all, so the
 * encoder could not read it off any slot other than the ones that set it.
 */
export type WelcomeImageSource = {
  url: string;
  width: number;
  height: number;
  alt: string;
  /**
   * Which edge the `cover` crop anchors to in welcome-email-assets.ts.
   * Defaults to "centre"; set it only when the source is far enough off the
   * slot's ratio that centring drops the subject out of frame.
   */
  coverPosition?: "centre" | "right";
};

export const WELCOME_IMAGE_SOURCES: {
  hero: WelcomeImageSource;
  mid: WelcomeImageSource;
  grow: WelcomeImageSource;
} = {
  /**
   * The hero. 620x257, not the 2:1 the source photo happens to be, because the
   * reference design's hero is 2.42:1 and the copy is positioned as a
   * proportion of the box — see HERO_TEXT_TOP below. Cropping 1240x620 to
   * 1240x514 trims wall and table, never the plants, so nothing is lost.
   */
  hero: {
    url: "https://whitesmoke-cattle-754161.hostingersite.com/sites/images/HomePage/WelcomeEmailHero.webp",
    width: 620,
    height: 257,
    alt: "Three succulents in cream pots on a wooden table, lit by soft afternoon sun.",
  },
  /** The "What You Can Expect" panel, artwork and all. */
  mid: {
    url: "https://whitesmoke-cattle-754161.hostingersite.com/sites/images/HomePage/WelcomeEmailMidImage.webp",
    width: 620,
    height: 226,
    alt: "What you can expect: Premium Plants, Safe and Reliable Delivery, Expert Plant Care Tips, and A Greener Community.",
  },
  /**
   * The photograph inside the "Let's Grow Together" panel.
   *
   * Squarer than the 2.83:1 the source ships, because the design sets it in a
   * portrait-ish cell beside the copy rather than as a full-bleed band. The
   * encode in welcome-email-assets.ts covers onto this ratio from the right,
   * which is what keeps the pot in frame.
   *
   * 292x226 rather than something squarer on purpose: the cell this fills is
   * 229px wide inside a 620px panel and the copy beside it is ~181px tall, so
   * 1.29:1 is the ratio at which the photo lands within a few pixels of the
   * copy's height. Taller still and the photo is left short of the row with a
   * cream gap under it, which is far more visible than a few pixels the other
   * way.
   *
   * `coverPosition: "right"` is required at this ratio, not cosmetic. The
   * source is 2.83:1, so covering onto 1.29:1 keeps only ~46% of its width.
   * Centred, that window lands the pot against the right edge with half of it
   * cropped off; anchored right, the pot sits centred in the frame.
   */
  grow: {
    url: "https://whitesmoke-cattle-754161.hostingersite.com/sites/images/HomePage/WelcomeEmailLastImage.webp",
    width: 292,
    height: 226,
    coverPosition: "right",
    alt: "A single succulent in a speckled marble pot on a round wooden table.",
  },
};

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
 * Hero geometry.
 *
 * The design puts the greeting ON the photograph, which is the one thing in
 * this template that cannot be a plain full-bleed <img>. The options were:
 *
 *   1. CSS `background-image`, plus the `background` attribute and a VML
 *      <v:rect> — how the order confirmation's hero is built. Works in Apple
 *      Mail, iOS, Outlook.com, Yahoo and Outlook desktop, and shows NOTHING in
 *      Gmail, which renders no CSS backgrounds at all. The first thing a new
 *      customer sees would be a flat cream band.
 *   2. Bake the words into the JPEG with sharp. Renders everywhere, but the
 *      text stops being text: not selectable, not searchable, invisible to a
 *      screen reader, unreachable by a translation pass.
 *   3. A real <img> with the copy pulled up over it by a negative margin.
 *
 * (3) ships. The photo is a `cid:` part so it renders unprompted in Gmail, and
 * the copy stays live HTML. Outlook may ignore the negative margin, and its
 * result is the copy stacked under the photo — the previous design, not a
 * broken one.
 *
 * The pull-up is HERO_OVERLAY, and it is set to the full hero height on
 * purpose. The arithmetic that makes this work: the copy row starts directly
 * under the photo, the pull-up lifts it by HERO_OVERLAY, and a row can never be
 * shorter than zero — so any pull-up at or above the copy's own height collapses
 * the row to nothing and the band is exactly the photo's height. That fixes the
 * text's position too: it starts HERO_TEXT_TOP below the top of the photo and
 * ends wherever the copy runs out, and the photo simply shows through below it.
 *
 * The slack is whatever is left over, HERO_HEIGHT - HERO_TEXT_TOP - the copy's
 * own height. At 620px that is ~30px of photo under the last line, and it is
 * deliberate: it absorbs the lede re-wrapping to an extra line without pushing
 * a cream strip over the bottom of the photograph. The media query drops the
 * overlay entirely on a phone, where a 2.4:1 box is far too short for this much
 * type, so mobile never comes near the limit.
 */
const HERO_HEIGHT = 257;
const HERO_TEXT_TOP = 50;
const HERO_OVERLAY = HERO_HEIGHT;
const HERO_COLUMN = 240;

/**
 * The masthead: wordmark left, the design's three links right.
 *
 * `masthead()` in emailChrome is the order email's header and is left alone —
 * this is a different component (no tagline, one line of nav), not a variant
 * of it. `.ss-hide-sm` drops the nav on a phone, where three links and a 25px
 * wordmark cannot share a 320px row.
 *
 * The circular mark is gone. It was the loudest thing in the first screen and it
 * pushed the wordmark out of true, while the brand is already stated twice more
 * in the message: in the hero's "Welcome to Succulent Sphere!" and in the
 * footer. `logo-mark.png` stays in build-email-assets.cjs even though this was
 * its only reader, so putting the mark back is a one-line change rather than a
 * re-encode of the source artwork.
 */
function welcomeMasthead(args: {
  links: Array<{ label: string; url: string }>;
}) {
  const links = args.links
    .map((link, index) => {
      const bullet =
        index === 0
          ? ""
          : `<span style="padding:0 9px;color:#C3CCC4">&bull;</span>`;
      return `${bullet}<a href="${escapeHtml(link.url)}" style="color:#5C6B61;text-decoration:none">${escapeHtml(link.label)}</a>`;
    })
    .join("");

  return `<tr>
            <td class="ss-masthead" style="padding:24px 34px 22px;background:${BRAND.card};border-radius:16px 16px 0 0">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td valign="middle" style="font-family:${FONT_SERIF};font-size:25px;line-height:1.1;color:${BRAND.ink}">Succulent Sphere</td>
                <td align="right" valign="middle" class="ss-hide-sm" style="font-family:${FONT_SANS};font-size:11px;line-height:1.4;letter-spacing:0.4px;color:#5C6B61">${links}</td>
              </tr></table>
            </td>
          </tr>`;
}

/**
 * THE HERO BAND.
 *
 * A photo row, then a copy row pulled up over it. The copy row contributes
 * zero net height, so the band is exactly as tall as the photo and the two
 * cannot drift apart.
 *
 * The copy column is 240px rather than half the panel because the photograph's
 * left side is not empty all the way across: the leftmost succulent starts at
 * about 47% of the image width, so a wider column would set the lede on top of
 * the plant. The lede is 12.5px, the smallest body copy in this template, and
 * it is what the design's own proportions allow at this measure.
 *
 * The photo is the first block in the card, so it carries the top corners. See
 * the note above heroPanel() in orderConfirmation.ts for why that radius moved
 * off the masthead and onto the hero.
 */
function heroPanel(args: {
  src: string;
  imageAlt: string;
  greeting: string;
  heading: string;
  lede: string;
}) {
  return `<tr>
            <td align="center" bgcolor="${BRAND.cream}" style="padding:0;background:${BRAND.cream};font-size:0;line-height:0">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:${PANEL_WIDTH}px;margin:0 auto">
                <tr>
                  <td style="padding:0;font-size:0;line-height:0">
                    <img src="${escapeHtml(args.src)}" width="${WELCOME_IMAGE_SOURCES.hero.width}" height="${HERO_HEIGHT}" alt="${escapeHtml(args.imageAlt)}" style="display:block;width:100%;max-width:${PANEL_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;font-size:0;line-height:0;border-radius:16px 16px 0 0" />
                  </td>
                </tr>
                <tr>
                  <td class="ss-hero-copy" valign="top" style="padding:0;font-size:0;line-height:0">
                    <div class="ss-hero-pull" style="margin-top:${-HERO_OVERLAY}px;padding:0">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%"><tr>
                        <td class="ss-hero-pad" valign="top" style="padding:${HERO_TEXT_TOP}px 34px 0 40px">
                          <table role="presentation" class="ss-hero-col" cellpadding="0" cellspacing="0" border="0" width="${HERO_COLUMN}" style="width:${HERO_COLUMN}px">
                            <tr>
                              <td>
                                <p class="ss-hero-hello" style="margin:0;padding:0;font-family:${FONT_SERIF};font-size:27px;line-height:1.14;color:${BRAND.ink};font-weight:normal;letter-spacing:-0.2px">${escapeHtml(args.greeting)}</p>
                                <h1 class="ss-hero-title" style="margin:11px 0 0;padding:0;font-family:${FONT_SERIF};font-size:30px;line-height:1.12;color:${BRAND.ink};font-weight:normal;letter-spacing:-0.4px">${escapeHtml(args.heading)}</h1>
                                <p class="ss-hero-lede" style="margin:13px 0 0;padding:0;font-family:${FONT_SANS};font-size:12.5px;line-height:1.62;color:${BRAND.body}">${escapeHtml(args.lede)}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr></table>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/**
 * "Let's Grow Together".
 *
 * An inset cream card: copy on the left, the photograph filling the right. The
 * design draws the heading in a handwritten script and this sets it in Georgia
 * italic instead, for the reason signature() records — script faces are missing
 * on most Android and Windows mail clients and silently fall back to a random
 * default, which reads worse than a deliberate serif. The forced <br> keeps the
 * "Let's / Grow Together" break the design uses.
 *
 * The button is NOT in here. The design sets it inside the card, but the
 * approved button carries a 21px glyph, a 15px label and 28px of side padding —
 * roughly 300px wide, which will not fit the 284px this column leaves. It sits
 * centred in its own row directly below instead, unchanged.
 */
function growPanel(args: { src: string; alt: string; copy: string }) {
  return `<tr>
            <td class="ss-pad" style="padding:30px 34px 0">
              <table role="presentation" class="ss-grow-card" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.cream};border-radius:14px">
                <tr class="ss-grow-row">
                  <td class="ss-grow-copy" width="328" valign="middle" style="width:328px;padding:22px 18px 22px 26px">
                    <div style="font-family:${FONT_SERIF};font-style:italic;font-size:22px;line-height:1.2;color:${BRAND.ink};letter-spacing:-0.2px">Let&rsquo;s<br />Grow Together</div>
                    <div style="padding-top:8px;width:54px;font-size:0;line-height:0">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="54"><tr>
                        <td style="border-top:2px solid ${BRAND.ink};font-size:0">&nbsp;</td>
                      </tr></table>
                    </div>
                    <p style="margin:12px 0 0;padding:0;font-family:${FONT_SANS};font-size:13px;line-height:1.6;color:${BRAND.body}">${escapeHtml(args.copy)}</p>
                  </td>
                  <td class="ss-grow-art" width="292" valign="top" style="width:292px;padding:0;font-size:0;line-height:0;border-radius:0 14px 14px 0">
                    <img src="${escapeHtml(args.src)}" width="${WELCOME_IMAGE_SOURCES.grow.width}" height="${WELCOME_IMAGE_SOURCES.grow.height}" alt="${escapeHtml(args.alt)}" style="display:block;width:100%;max-width:${WELCOME_IMAGE_SOURCES.grow.width}px;height:auto;border:0;outline:none;text-decoration:none;font-size:0;line-height:0" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/**
 * "Thank you for choosing Succulent Sphere!" and the leaf rule beneath it.
 *
 * The rule is a three-cell table rather than a bordered <p> because Outlook
 * renders a border on a block element inconsistently, and the leaf has to sit
 * ON the line, which needs a cell of its own between the two halves.
 */
function thanksBlock(args: { base: string }) {
  return `<tr>
            <td class="ss-pad" align="center" style="padding:32px 34px 6px;background:${BRAND.card}">
              <div style="font-family:${FONT_SERIF};font-size:18px;line-height:1.3;color:${BRAND.ink}">Thank you for choosing Succulent Sphere!</div>
              <div style="padding-top:9px;font-family:${FONT_SANS};font-size:9px;letter-spacing:2.4px;color:#8B988D">HAPPIER HOMES. GREENER TOMORROWS.</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:18px auto 0"><tr>
                <td width="56" align="right" valign="middle" style="width:56px;font-size:0;line-height:0">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                    <td style="border-top:1px solid #D8D3C9;font-size:0">&nbsp;</td>
                  </tr></table>
                </td>
                <td width="26" align="center" valign="middle" style="width:26px;font-size:0;line-height:0">
                  <img src="${escapeHtml(assetUrl(args.base, "icon-leaf.png"))}" width="15" height="15" alt="" style="display:block;width:15px;height:15px;border:0;outline:none;text-decoration:none" />
                </td>
                <td width="56" align="left" valign="middle" style="width:56px;font-size:0;line-height:0">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                    <td style="border-top:1px solid #D8D3C9;font-size:0">&nbsp;</td>
                  </tr></table>
                </td>
              </tr></table>
            </td>
          </tr>`;
}

/**
 * Per-template responsive rules. Indentation lines these up inside
 * documentShell's <style> block, as in the other two templates.
 *
 * The hero rules are the important ones and they are not a refinement — the
 * overlay is switched OFF below 620px. A 2.4:1 box at 390px is 160px tall, the
 * heading alone would wrap to three lines in the remaining width, and the copy
 * would run off the bottom of the photograph. Stacked, the same markup reads as
 * a normal hero with the greeting beneath it, which is the design's own mobile
 * behaviour everywhere else. Every rule here only ever widens or unhides.
 */
const WELCOME_MEDIA_CSS = [
  "        .ss-pad { padding-left:22px !important; padding-right:22px !important; }",
  "        .ss-masthead { padding-left:22px !important; padding-right:22px !important; }",
  "        /* Drop the overlay: no pull-up, full-width copy, normal type sizes.",
  "           See the note above HERO_OVERLAY for why this is not a tweak. */",
  "        .ss-hero-pull { margin-top:0 !important; }",
  "        .ss-hero-pad { padding:26px 22px 4px 22px !important; }",
  "        .ss-hero-col { width:100% !important; }",
  "        .ss-hero-hello { font-size:24px !important; line-height:1.16 !important; }",
  "        .ss-hero-title { font-size:25px !important; line-height:1.16 !important; }",
  "        .ss-hero-lede { font-size:14.5px !important; line-height:1.6 !important; }",
  "        /* The masthead's three links cannot share a 320px row with a 25px",
  "           wordmark. */",
  "        .ss-hide-sm { display:none !important; }",
  "        /* 'Let's Grow Together': copy and photo stacked, photo first, because",
  "           a side-by-side pair at 320px leaves each column ~150px. Setting",
  "           display:block on the cells alone does NOT stack them — the row and",
  "           the card have to come out of table layout too, or the copy cell is",
  "           still sized off its width attribute and overflows the viewport by",
  "           exactly the difference. This is the whole chain, all four rules. */",
  "        .ss-grow-card, .ss-grow-row { display:block !important; width:100% !important; }",
  "        .ss-grow-art { display:block !important; width:100% !important; box-sizing:border-box !important; }",
  "        .ss-grow-art img { max-width:100% !important; border-radius:0 0 14px 14px !important; }",
  "        /* box-sizing matters here: these cells are content-box by default, so",
  "           width:100% PLUS 22px of padding a side is 44px wider than the card",
  "           and overflows the viewport by exactly that much. border-box makes the",
  "           declared 100% include the padding. */",
  "        .ss-grow-copy { display:block !important; width:100% !important; box-sizing:border-box !important; padding:22px 22px 6px 22px !important; }",
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
    grow: input.images?.grow || images.grow.url,
  };

  const subject = fullName
    ? `Welcome to Succulent Sphere, ${fullName}`
    : "Welcome to Succulent Sphere";

  const preheader =
    "Your account is ready. Here is what to expect from us: handpicked " +
    "plants, careful delivery, and real plant-care help whenever you need it.";

  // The design opens on a small-caps "HELLO THERE!" eyebrow, which put the
  // customer's name in 9.5px type above a 30px headline, so the one thing that
  // makes this a welcome rather than a brochure was the smallest thing on the
  // page. This greets by name at nearly headline size instead. It is the same
  // name the plain-text twin greets with, so the two cannot disagree, and an
  // account with no first name gets the design's own wording rather than a
  // dangling comma.
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  const html = documentShell({
    title: subject,
    mediaCss: WELCOME_MEDIA_CSS,
    preheaderHtml: `${escapeHtml(preheader)} ${PREHEADER_PAD}`,
    bodyHtml: `      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:${PANEL_WIDTH}px;margin:0 auto;background:${BRAND.card};border-radius:16px">
        ${welcomeMasthead({
          links: [
            { label: "Premium Succulents", url: shopUrl },
            { label: "Plant Care", url: careUrl },
            { label: "Happy Homes", url: beginnerUrl },
          ],
        })}
        ${heroPanel({
          src: src.hero,
          imageAlt: images.hero.alt,
          greeting,
          heading: "Welcome to Succulent Sphere!",
          // Two lines, and the length is load-bearing. The hero photo's
          // lower-left corner is the dark leafy plant, not flat wall, so a third
          // line drops the tail of this copy onto dark green and costs real
          // legibility. The greeting above pushed this block down by roughly a
          // line, which is what brought the tail onto the plant, so the fix is
          // fewer words rather than a tighter top offset: the offset is shared
          // with the greeting, and shrinking it moves the name off the clean
          // wall at the top. At 240px and 12.5px the measure runs ~45 characters
          // per line, so two lines is a hard ceiling near 90 characters and this
          // is 85. "greener, happier homes" is not lost -- the sign-off under the
          // CTA still carries it, in full.
          lede:
            "We\u2019re so happy to have you here. You\u2019ve joined a growing " +
            "community of plant lovers.",
        })}
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
        ${growPanel({
          src: src.grow,
          alt: images.grow.alt,
          copy:
            "Keep an eye on your inbox for plant care tips, exclusive offers, " +
            "and the latest additions to our collection.",
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
        ${thanksBlock({ base })}
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
          reason: `You are receiving this because you created an account at ${siteHost}.`,
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
 * carrying every link the HTML does: for a text-only reader those links are the
 * entire email, so collapsing them to a single shop URL would throw away most
 * of the message.
 *
 * The four "What You Can Expect" pillars are restated here as live text, which
 * doubles as the accessible copy for artwork that bakes them in as pixels — and
 * so does the footer's four trust claims, for the same reason.
 */
function buildPlainText(args: {
  name: string;
  shopUrl: string;
  careUrl: string;
  beginnerUrl: string;
  accountUrl: string;
}) {
  return `Hi ${args.name},

Welcome to Succulent Sphere!

We are so happy to have you here. You are now part of a growing community of
plant lovers who believe in greener, happier homes.

WHAT YOU CAN EXPECT
  Premium Plants            Handpicked, healthy succulents for your home and office.
  Safe & Reliable Delivery  Your plants will reach you fresh and on time, with great care.
  Expert Plant Care Tips    Easy guides and helpful advice to help your plants thrive.
  A Greener Community       Be part of a community that loves plants as much as you do.

Let's Grow Together

Keep an eye on your inbox for plant care tips, exclusive offers, and the
latest additions to our collection.

Explore all succulents: ${args.shopUrl}

START HERE
  Beginner-friendly plants: ${args.beginnerUrl}
  Plant care guides:         ${args.careUrl}
  Your account:              ${args.accountUrl}

WHY YOU ARE GETTING THIS
  Premium quality plants, carefully packed, safe and reliable delivery, and
  plant care support whenever you need it.

Thank you for choosing Succulent Sphere!
Happier homes. Greener tomorrows.

If you ever need a hand, just reply to this email. A real person who grows
plants will answer.

Succulent Sphere
`;
}

export default buildWelcomeEmail;


