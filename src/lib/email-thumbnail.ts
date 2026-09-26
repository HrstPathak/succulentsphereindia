import "server-only";

/**
 * Product thumbnails for the order confirmation email, as MIME inline parts.
 *
 * Why not just point <img> at the catalogue URL: Gmail blocks remote images by
 * default and shows a grey placeholder until the reader clicks "Display
 * images". The confirmation is the email most likely to be filed unread, so a
 * thumbnail that only appears for people who have already decided to open it
 * is worth very little. Embedding the bytes as Content-ID attachments sidesteps
 * the proxy entirely — the image is part of the message, so it renders
 * immediately, in Gmail and Outlook alike.
 *
 * The catalogue images are also far too heavy for the job. The Bunny Ear
 * product shot is an 819 KB PNG; a 64px thumbnail of it should be a few KB.
 * Re-encoding at 128px (2x of the 64px cell, so it stays sharp on a retina
 * phone) turns that into roughly 6 KB, which is the difference between an
 * email that loads instantly and one that stalls behind an 800 KB fetch per
 * line item.
 *
 * Everything here is best-effort. A thumbnail is a nicety; a confirmation that
 * fails to send because one product image 404s is a lost order notification, so
 * any failure drops that one image and carries on.
 */

/** Displayed size of the thumbnail cell in the template. */
const THUMB_PX = 64;

/** 2x for retina screens. */
const SOURCE_PX = THUMB_PX * 2;

/** JPEG quality. Below ~70 a green plant starts to look bruised. */
const QUALITY = 72;

/** Give up on a slow catalogue host rather than delaying the whole send. */
const FETCH_TIMEOUT_MS = 6000;

/**
 * Refuse to pull anything enormous into memory. The largest catalogue shot seen
 * is well under this; anything bigger is a video frame that was saved by
 * accident.
 */
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

/**
 * How many thumbnails to embed. Each one is base64 in the MIME body, so this is
 * really a guard on total message size. A cart with 30 plants is a wholesale
 * order that should be quoted, not emailed line-by-line.
 */
const MAX_THUMBS = 8;

/** Keeps the whole set from dominating the message. */
const MAX_TOTAL_BYTES = 900 * 1024;

export type InlineImage = {
  /** The `cid:` name referenced from the HTML, without the `cid:` prefix. */
  cid: string;
  content: Buffer;
  contentType: string;
  filename: string;
};

export type ThumbnailedItems<T extends { image?: string }> = {
  /** The same items, with `image` rewritten to a `cid:` reference. */
  items: T[];
  attachments: InlineImage[];
  /** How many images were dropped because they could not be prepared. */
  skipped: number;
};

function usableRemoteUrl(value: unknown): string {
  const url = String(value ?? "").trim();
  if (!/^https?:\/\//i.test(url)) return "";
  try {
    // A URL that parses is one worth fetching; this also rejects the malformed
    // strings that would otherwise surface as an unhelpful fetch error.
    new URL(url);
    return url;
  } catch {
    return "";
  }
}


async function fetchSource(url: string): Promise<Buffer | null> {
  const response = await fetch(url, {
    // The catalogue host already serves long-lived cache headers; reusing them
    // keeps repeat orders off the origin.
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "image/*" },
  });
  if (!response.ok) return null;

  // Check the declared size before reading, so an oversized body is refused
  // without being buffered.
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_SOURCE_BYTES) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.byteLength <= MAX_SOURCE_BYTES ? buffer : null;
}

async function toThumbnail(source: Buffer): Promise<Buffer | null> {
  // Imported lazily. sharp is a native module: requiring it at module scope
  // would make the whole email module fail to load on a runtime that cannot
  // load it, and the right response to a missing image optimiser is to send the
  // email without thumbnails, not to not send the email.
  const { default: sharp } = await import("sharp");
  return sharp(source)
    .rotate()
    // fit: "cover" crops to a square rather than letterboxing. Catalogue shots
    // are inconsistently proportioned and a letterboxed 64px cell ends up with
    // a stripe of background down one side.
    .resize(SOURCE_PX, SOURCE_PX, { fit: "cover", position: "attention" })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer();
}

/**
 * Replaces remote image URLs on `items` with `cid:` references, returning the
 * attachments to send alongside them.
 *
 * Items are processed in order and the first occurrence of a given URL wins, so
 * a cart with three identical pots embeds the bytes once.
 */
export async function buildProductThumbnails<T extends { image?: string }>(
  items: T[],
): Promise<ThumbnailedItems<T>> {
  const attachments: InlineImage[] = [];
  const byUrl = new Map<string, string>();
  const out: T[] = [];
  let skipped = 0;
  let totalBytes = 0;

  for (const item of items) {
    const url = usableRemoteUrl(item.image);

    if (!url) {
      // No usable image. Leave `image` empty so the template renders the row
      // without a thumbnail cell rather than a broken one.
      out.push({ ...item, image: "" });
      continue;
    }

    const existing = byUrl.get(url);
    if (existing) {
      out.push({ ...item, image: existing });
      continue;
    }

    if (attachments.length >= MAX_THUMBS || totalBytes >= MAX_TOTAL_BYTES) {
      // Out of budget. Render the remaining rows without a thumbnail.
      skipped += 1;
      out.push({ ...item, image: "" });
      continue;
    }

    try {
      const source = await fetchSource(url);
      const content = source ? await toThumbnail(source) : null;
      if (!content) {
        skipped += 1;
        out.push({ ...item, image: "" });
        continue;
      }

      const cid = `product-${attachments.length}`;
      attachments.push({
        cid,
        content,
        contentType: "image/jpeg",
        filename: `${cid}.jpg`,
      });
      totalBytes += content.byteLength;
      byUrl.set(url, `cid:${cid}`);
      out.push({ ...item, image: `cid:${cid}` });
    } catch {
      // A dead catalogue host must not cost the customer their confirmation.
      skipped += 1;
      out.push({ ...item, image: "" });
    }
  }

  return { items: out, attachments, skipped };
}
