export const DEFAULT_PRODUCT_IMAGE_ALT = "Succulent Sphere product image";

export function resolveProductImageAlt(alt: unknown): string {
  const normalized = String(alt ?? "").trim();
  return normalized || DEFAULT_PRODUCT_IMAGE_ALT;
}
