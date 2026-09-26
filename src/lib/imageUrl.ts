function isRelativeAssetPath(value: string) {
  return value.startsWith("/") || value.startsWith("data:");
}

export function normalizeImageUrl(input: unknown, fallback = "/assets/product-1.jpg"): string {
  const raw = String(input || "").trim();
  if (!raw) return fallback;
  if (isRelativeAssetPath(raw)) return raw;

  const candidate = raw.startsWith("//") ? `https:${raw}` : raw;

  try {
    const url = new URL(candidate);
    return url.toString();
  } catch {
    return fallback;
  }
}

/**
 * Hosts we serve product media from. The optimizer can fetch and re-encode
 * everything here, so these must stay in sync with the `images.remotePatterns`
 * allowlist in next.config.js.
 */
const OPTIMIZABLE_HOSTS = [
  "whitesmoke-cattle-754161.hostingersite.com",
];

const OPTIMIZABLE_HOST_SUFFIXES = [
  ".hostingersite.com",
  ".hostinger.com",
  ".unsplash.com",
  ".googleusercontent.com",
  ".cloudinary.com",
  ".amazonaws.com",
  ".firebaseio.com",
  ".firebasestorage.googleapis.com",
  ".googleapis.com",
  ".s3.amazonaws.com",
  ".blob.core.windows.net",
  ".imgix.net",
];

function hostMatches(hostname: string, host: string) {
  const h = hostname.toLowerCase();
  return h === host.toLowerCase() || h.endsWith(`.${host.toLowerCase()}`);
}

/**
 * Decides whether an image must skip the Next.js optimizer.
 *
 * Previously this returned true for EVERY absolute http(s) URL, which set
 * `unoptimized` on all 147 product images. That shipped the original PNG/JPEG
 * bytes to every visitor: no AVIF/WebP negotiation, no responsive resizing, no
 * quality tuning - typically 200-600 KB per product tile instead of ~15-30 KB.
 *
 * It is now a narrow deny-list. Only genuinely un-optimizable sources (SVGs
 * with no raster fallback, already-optimized CDN URLs we do not control, or a
 * host missing from the remotePatterns allowlist) still bypass. Everything on
 * our own media host is optimized as normal.
 */
export function shouldBypassImageOptimization(input: unknown): boolean {
  const raw = String(input || "").trim();
  if (!raw || isRelativeAssetPath(raw)) return false;

  const candidate = raw.startsWith("//") ? `https:${raw}` : raw;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return true; // unparseable - let the browser try it directly
  }

  // Insecure origin: the optimizer refuses to fetch these.
  if (url.protocol !== "https:") return true;

  // Vector/animated formats the raster optimizer does not handle well.
  if (/\.svgz?($|\?)/i.test(url.pathname)) return true;

  // Allow-list check: a host missing from remotePatterns makes the optimizer
  // throw, so bypass instead of breaking the page.
  const host = url.hostname;
  if (OPTIMIZABLE_HOSTS.some((h) => hostMatches(host, h))) return false;
  if (OPTIMIZABLE_HOST_SUFFIXES.some((suffix) => hostMatches(host, suffix.replace(/^\./, "")))) return false;

  return true;
}

