import "server-only";

/**
 * Welcome-email artwork, prepared as MIME inline parts.
 *
 * Two problems this solves, both of which a hosted <img src> would not.
 *
 * 1. Remote images are blocked by default. Gmail shows a grey placeholder until
 *    the reader clicks "Display images", and Outlook and Apple Mail gate them
 *    behind a "blocked pictures" banner too. This is the first email a new
 *    customer ever receives from the brand; three grey boxes would be the
 *    introduction. Embedding the bytes as Content-ID parts means they are part
 *    of the message and render unprompted, which is the same fix the order
 *    confirmation already uses for product thumbnails.
 *
 * 2. The sources are WebP, which Outlook desktop cannot render at all, and at
 *    ~1,500-2,100px they are several times the size this layout needs. Both
 *    are corrected here: re-encoded to JPEG at 2x the displayed box, which is
 *    sharp on a retina screen and lands around 170KB for all three rather than
 *    the 260KB the WebPs weigh today.
 *
 * Best-effort, like email-thumbnail.ts: a photo that will not load costs the
 * email its artwork, never the email itself. The template falls back to the
 * hosted URL, so a degraded send still looks intentional.
 */

import { WELCOME_IMAGE_SOURCES } from "@/lib/email-templates/welcomeEmail";
import type { InlineImage } from "@/lib/email-thumbnail";

/** 2x of the 620px panel, so the artwork stays sharp on a retina screen. */
const SCALE = 2;

/**
 * JPEG quality. The artwork is smooth cream and soft-focus green, which is the
 * worst case for JPEG banding, so this is not pushed down as far as the 64px
 * product thumbnails in email-thumbnail.ts manage.
 */
const QUALITY = 76;

/** Give up on a slow host rather than delaying the signup response. */
const FETCH_TIMEOUT_MS = 8000;

/** Refuse to pull anything enormous into memory. */
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

/**
 * Ceiling on the whole set. Base64 inflates by 4/3, so 400KB of JPEG becomes
 * ~535KB in the MIME body. Generous against the ~170KB this actually produces,
 * but bounded, because these bytes travel on the request that creates the
 * account and a runaway image host should not be able to stall a signup.
 */
const MAX_TOTAL_BYTES = 400 * 1024;

export type WelcomeImageKey = keyof typeof WELCOME_IMAGE_SOURCES;

export type PreparedWelcomeImages = {
  /** `cid:` references keyed by slot, ready to hand to the template. */
  images: Partial<Record<WelcomeImageKey, string>>;
  attachments: InlineImage[];
  /** Slots that could not be prepared; the template uses the hosted URL. */
  skipped: WelcomeImageKey[];
  /** Total encoded bytes actually embedded. */
  bytes: number;
};

async function fetchSource(url: string): Promise<Buffer | null> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "image/*" },
  });
  if (!response.ok) return null;

  // Check the declared size before reading so an oversized body is refused
  // without being buffered.
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_SOURCE_BYTES) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.byteLength <= MAX_SOURCE_BYTES ? buffer : null;
}

async function encode(
  source: Buffer,
  displayWidth: number,
  displayHeight: number,
): Promise<Buffer | null> {
  // Imported lazily: sharp is native, and a runtime that cannot load it should
  // send the welcome without embedded artwork rather than not send it at all.
  const { default: sharp } = await import("sharp");
  return sharp(source)
    .rotate()
    // "cover" onto the exact display ratio. The sources are already close to
    // the slots they fill, so this trims a few pixels rather than letterboxing.
    .resize(displayWidth * SCALE, displayHeight * SCALE, {
      fit: "cover",
      position: "centre",
    })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer();
}

/**
 * Fetches, re-encodes and returns the artwork, plus the attachments to send
 * alongside it.
 *
 * Slots are processed in visual order and each one is independent: a failure
 * marks that slot skipped and the rest still embed.
 */
export async function buildWelcomeImages(): Promise<PreparedWelcomeImages> {
  const images: Partial<Record<WelcomeImageKey, string>> = {};
  const attachments: InlineImage[] = [];
  const skipped: WelcomeImageKey[] = [];
  let bytes = 0;

  for (const key of Object.keys(WELCOME_IMAGE_SOURCES) as WelcomeImageKey[]) {
    const slot = WELCOME_IMAGE_SOURCES[key];

    if (bytes >= MAX_TOTAL_BYTES) {
      skipped.push(key);
      continue;
    }

    try {
      const source = await fetchSource(slot.url);
      if (!source) {
        skipped.push(key);
        continue;
      }
      const content = await encode(source, slot.width, slot.height);
      if (!content) {
        skipped.push(key);
        continue;
      }
      const cid = `welcome-${key}`;
      attachments.push({
        cid,
        content,
        contentType: "image/jpeg",
        filename: `${cid}.jpg`,
      });
      bytes += content.byteLength;
      images[key] = `cid:${cid}`;
    } catch {
      // A dead image host must not cost a new customer their welcome.
      skipped.push(key);
    }
  }

  return { images, attachments, skipped, bytes };
}
