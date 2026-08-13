type CurrencyFormatOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export function formatCurrency(
  amount: string | number,
  currency = "INR",
  options: CurrencyFormatOptions = {}
): string {
  const value = Number(amount);
  const code = String(currency || "INR").toUpperCase();

  if (!Number.isFinite(value)) {
    return code === "INR" ? `₹${amount}` : `${code} ${amount}`;
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code,
    currencyDisplay: "symbol",
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(value);
}

export function formatINR(amount: string | number, fractionDigits = 2): string {
  return formatCurrency(amount, "INR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
