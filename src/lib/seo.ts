const FALLBACK_SITE_URL = "https://succulentsphere.com";

function normalizeSiteUrl(value: string | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return FALLBACK_SITE_URL;
  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return parsed.origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const SITE_NAME = "Succulent Sphere";

export function absoluteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
}
