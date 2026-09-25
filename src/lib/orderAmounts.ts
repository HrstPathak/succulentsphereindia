type OrderLike = Record<string, unknown>;

function record(value: unknown): OrderLike {
  return value && typeof value === "object" ? (value as OrderLike) : {};
}

function amountValue(value: unknown): unknown {
  return value && typeof value === "object" ? record(value).amount : value;
}

function firstPositive(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(amountValue(value));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function firstPresentAmount(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null || String(value).trim() === "") continue;
    const parsed = Number(amountValue(value));
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

function lineItemAttribute(order: OrderLike, key: string) {
  const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
  for (const item of lineItems) {
    const attributes = record(item).customAttributes;
    if (!Array.isArray(attributes)) continue;
    const match = attributes.find(
      (attribute) =>
        attribute &&
        typeof attribute === "object" &&
        String(record(attribute).key || "") === key,
    );
    if (
      match &&
      record(match).value !== undefined &&
      record(match).value !== null &&
      String(record(match).value).trim() !== ""
    ) {
      return record(match).value;
    }
  }
  return undefined;
}

function itemQuantity(item: OrderLike) {
  return Math.max(1, Math.round(Number(item.quantity ?? item.qty ?? 1) || 1));
}

function itemTotal(item: OrderLike) {
  const explicit = Number(
    amountValue(item.discountedTotalPrice ?? item.originalTotalPrice),
  );
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return Math.max(0, Number(amountValue(item.price ?? item.unitPrice) || 0) * itemQuantity(item));
}

export function getOrderLineItemTotal(order: unknown) {
  const value = record(order);
  const lineItems = Array.isArray(value.lineItems) ? value.lineItems : [];
  return lineItems.reduce(
    (sum, item) => sum + itemTotal(record(item)),
    0,
  );
}

/** Resolve a canonical grand total without allowing a legacy zero to mask valid totals. */
export function getOrderGrandTotal(order: unknown) {
  const value = record(order);
  const lineItemTotal = getOrderLineItemTotal(value);
  const explicitTotal = firstPositive(
    value.currentTotalPrice,
    value.totalPrice,
    value.total,
    value.invoiceTotal,
    value.orderTotal,
  );
  if (explicitTotal > 0) return Number(explicitTotal.toFixed(2));

  const subtotal = firstPositive(value.currentSubtotalPrice, value.subtotal, lineItemTotal);
  const shipping = firstPositive(value.currentTotalShippingPrice, value.shipping);
  const tax = firstPositive(value.currentTotalTax, value.tax, value.taxAmount);
  const codFee = firstPositive(value.codFee);
  const discount = firstPositive(value.discount, value.discountAmount);
  const composedTotal = subtotal > 0
    ? Math.max(0, subtotal + shipping + tax + codFee - discount)
    : 0;
  const fallback = firstPositive(composedTotal, lineItemTotal);
  return Number(fallback.toFixed(2));
}

export type OrderPaymentSummary = {
  paymentMode: "COD" | "Prepaid";
  grandTotal: number;
  paidAmount: number;
  depositAmount: number;
  codBalance: number;
  walletAmount: number;
};

function normalizedPaymentMode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isCodMode(value: unknown) {
  const mode = normalizedPaymentMode(value);
  return (
    mode === "cod" ||
    mode === "cash_on_delivery" ||
    mode === "cash_on_delivery_cod" ||
    mode.startsWith("cod_")
  );
}

function isPrepaidMode(value: unknown) {
  const mode = normalizedPaymentMode(value);
  return (
    mode === "prepaid" ||
    mode === "pre_paid" ||
    mode === "paid" ||
    mode === "online" ||
    mode === "razorpay"
  );
}

/** Resolve payment state once for carrier, customer UI, admin UI, and email paths. */
export function getOrderPaymentSummary(order: unknown): OrderPaymentSummary {
  const value = record(order);
  const grandTotal = getOrderGrandTotal(value);
  const methodValue =
    value.paymentMode ??
    value.payment_method ??
    lineItemAttribute(value, "payment_mode");
  const method = normalizedPaymentMode(methodValue);
  const financialStatus = String(value.financialStatus ?? "").trim().toUpperCase();
  const codMetadata = [
    value.cod_balance,
    value.codBalance,
    value.cod_deposit,
    value.codDepositAmount,
    value.codDeposit,
    lineItemAttribute(value, "cod_balance"),
    lineItemAttribute(value, "cod_deposit"),
  ].some((item) => firstPresentAmount(item) !== undefined);
  const explicitlyPrepaid = isPrepaidMode(methodValue);
  const isCod = !explicitlyPrepaid && (
    isCodMode(methodValue) ||
    financialStatus === "DEPOSIT_PAID" ||
    codMetadata
  );
  const walletAmount = Math.max(
    0,
    firstPresentAmount(
      value.walletAmountUsed,
      value.walletAmountApplied,
      lineItemAttribute(value, "wallet_amount"),
    ) ?? 0,
  );

  if (!isCod) {
    return {
      paymentMode: "Prepaid",
      grandTotal,
      paidAmount: grandTotal,
      depositAmount: 0,
      codBalance: 0,
      walletAmount,
    };
  }

  const explicitBalance = firstPresentAmount(
    value.cod_balance,
    value.codBalance,
    lineItemAttribute(value, "cod_balance"),
  );
  const explicitDeposit = firstPresentAmount(
    value.cod_deposit,
    value.codDepositAmount,
    value.codDeposit,
    lineItemAttribute(value, "cod_deposit"),
  );
  const explicitPaymentReceived = firstPresentAmount(
    value.paymentReceived,
    value.paidAmount,
    value.razorpayAmount,
    lineItemAttribute(value, "payment_received"),
    lineItemAttribute(value, "paymentReceived"),
  );
  const explicitPayableAmount =
    method === "cod_deposit" || financialStatus === "DEPOSIT_PAID"
      ? firstPresentAmount(value.payableAmount)
      : undefined;
  const hasPartialPaymentSignal =
    method === "cod_deposit" ||
    financialStatus === "DEPOSIT_PAID" ||
    explicitBalance !== undefined ||
    explicitDeposit !== undefined ||
    explicitPaymentReceived !== undefined ||
    walletAmount > 0;

  let depositAmount = 0;
  if (hasPartialPaymentSignal) {
    depositAmount = Math.min(
      grandTotal,
      Math.max(
        0,
        explicitDeposit ??
          explicitPaymentReceived ??
          explicitPayableAmount ??
          firstPresentAmount(process.env.DELHIVERY_COD_DEPOSIT_AMOUNT) ??
          100,
      ),
    );
  }

  const rawBalance =
    explicitBalance !== undefined
      ? explicitBalance
      : hasPartialPaymentSignal
        ? grandTotal - depositAmount - walletAmount
        : grandTotal;
  const codBalance = Math.max(0, Math.min(grandTotal, Number(rawBalance.toFixed(2))));
  const paidAmount = Math.max(0, Math.min(grandTotal, Number((grandTotal - codBalance).toFixed(2))));
  const paymentMode = codBalance > 0 ? "COD" : "Prepaid";

  return {
    paymentMode,
    grandTotal,
    paidAmount: paymentMode === "Prepaid" ? grandTotal : paidAmount,
    depositAmount: paymentMode === "Prepaid" ? Math.min(grandTotal, depositAmount) : depositAmount,
    codBalance: paymentMode === "Prepaid" ? 0 : codBalance,
    walletAmount,
  };
}
