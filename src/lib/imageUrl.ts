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

export function shouldBypassImageOptimization(input: unknown): boolean {
  const raw = String(input || "").trim();
  if (!raw || isRelativeAssetPath(raw)) return false;

  const candidate = raw.startsWith("//") ? `https:${raw}` : raw;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
