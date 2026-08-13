export function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function getDiscountPercent(
  price: string | number | null | undefined,
  compareAtPrice: string | number | null | undefined
): number | null {
  const current = toNumber(price);
  const original = toNumber(compareAtPrice);
  if (!Number.isFinite(current) || !Number.isFinite(original)) return null;
  if (current <= 0 || original <= current) return null;
  const percent = Math.round(((original - current) / original) * 100);
  return percent > 0 ? percent : null;
}
