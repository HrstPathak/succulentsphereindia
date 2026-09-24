export const DELHIVERY_MAX_BOXES = 5;
export const DELHIVERY_VOLUMETRIC_DIVISOR = 5;

export type DelhiveryShippingMode = "Surface" | "Express";
export type DelhiveryPaymentMode = "Prepaid" | "COD";

export type DelhiveryCompanyDetails = {
  name: string;
  gstin: string;
  pan: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  contactName: string;
  phone: string;
  email: string;
  packagesPerMonth: number | null;
  pickupLocation: string;
  pickupPincode: string;
  logoUrl: string;
  hsnCode: string;
};

export type DelhiveryShipmentItem = {
  title: string;
  sku: string;
  quantity: number;
  unitPrice: number;
};

export type DelhiveryBox = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightGrams: number;
};

export type DelhiveryShipmentDetails = {
  version: 1;
  channel: string;
  orderReference: string;
  orderDate: string;
  shippingMode: DelhiveryShippingMode;
  paymentMode: DelhiveryPaymentMode;
  packageType: string;
  boxes: DelhiveryBox[];
  fragile: boolean;
  invoiceTotal: number;
  collectableAmount: number;
  items: DelhiveryShipmentItem[];
  notes: string;
  confirmed: boolean;
};

export type DelhiveryServiceability = {
  serviceable: boolean;
  paymentServiceable: boolean;
  pincode: string;
  city: string;
  district: string;
  state: string;
  sortCode: string;
  maxWeightGrams: number;
  maxAmount: number;
  message: string;
  checkedAt: string;
};

export type DelhiveryRateQuote = {
  mode: "Surface" | "Express";
  amount: number;
  grossAmount: number;
  codAmount: number;
  freightAmount: number;
  fuelSurcharge: number;
  zone: string;
  chargeableWeightGrams: number;
  approximate: true;
  raw: Record<string, unknown>;
};

export type DelhiveryPackageMetrics = {
  actualWeightGrams: number;
  volumetricWeightGrams: number;
  chargeableWeightGrams: number;
  boxes: Array<DelhiveryBox & {
    volumetricWeightGrams: number;
    chargeableWeightGrams: number;
  }>;
};

const text = (value: unknown, fallback = "") => {
  const result = String(value ?? "").trim();
  return result || fallback;
};

const numeric = (value: unknown, fallback = 0) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
};

const money = (value: unknown) => Number(Math.max(0, numeric(value)).toFixed(2));
const grams = (value: unknown, fallback: number) => Math.max(1, Math.round(numeric(value, fallback)));
const centimeters = (value: unknown, fallback: number) => Math.max(0.1, Number(numeric(value, fallback).toFixed(2)));
const pincode = (value: unknown) => text(value).replace(/\D/g, "").slice(0, 6);
const phone = (value: unknown) => text(value).replace(/\D/g, "").slice(0, 15);

export function normalizeDelhiveryPhone(value: unknown): string {
  return phone(value);
}

export function normalizeDelhiveryPincode(value: unknown): string {
  return pincode(value);
}

function defaultBox(): DelhiveryBox {
  return {
    lengthCm: centimeters(
      process.env.NEXT_PUBLIC_DELHIVERY_PACKAGE_LENGTH_CM ||
        process.env.DELHIVERY_PACKAGE_LENGTH_CM,
      14,
    ),
    widthCm: centimeters(
      process.env.NEXT_PUBLIC_DELHIVERY_PACKAGE_WIDTH_CM ||
        process.env.DELHIVERY_PACKAGE_BREADTH_CM,
      12,
    ),
    heightCm: centimeters(
      process.env.NEXT_PUBLIC_DELHIVERY_PACKAGE_HEIGHT_CM ||
        process.env.DELHIVERY_PACKAGE_HEIGHT_CM,
      12,
    ),
    weightGrams: grams(
      process.env.NEXT_PUBLIC_DELHIVERY_PACKAGE_WEIGHT_GM ||
        process.env.DELHIVERY_PACKAGE_WEIGHT_GM,
      450,
    ),
  };
}

export function normalizeDelhiveryBox(
  input: unknown,
  fallback: DelhiveryBox = defaultBox(),
): DelhiveryBox {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    lengthCm: centimeters(value.lengthCm ?? value.length_cm, fallback.lengthCm),
    widthCm: centimeters(value.widthCm ?? value.width_cm ?? value.breadthCm, fallback.widthCm),
    heightCm: centimeters(value.heightCm ?? value.height_cm, fallback.heightCm),
    weightGrams: grams(value.weightGrams ?? value.weight_gm, fallback.weightGrams),
  };
}

export function normalizeDelhiveryDetails(
  input: unknown,
  fallback?: Partial<DelhiveryShipmentDetails>,
): DelhiveryShipmentDetails {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const baseBox = normalizeDelhiveryBox(
    Array.isArray(value.boxes) ? value.boxes[0] : undefined,
  );
  const rawBoxes = Array.isArray(value.boxes) ? value.boxes : [];
  const count = Math.max(
    1,
    Math.min(
      DELHIVERY_MAX_BOXES,
      Math.round(numeric(value.boxCount, rawBoxes.length || 1)),
    ),
  );
  const boxes = Array.from({ length: count }, (_, index) =>
    normalizeDelhiveryBox(rawBoxes[index], index > 0 ? baseBox : defaultBox()),
  );
  const rawItems = Array.isArray(value.items) ? value.items : [];
  const items = rawItems
    .map((item) => {
      const entry = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        title: text(entry.title, "Product"),
        sku: text(entry.sku ?? entry.productId ?? entry.id),
        quantity: Math.max(1, Math.round(numeric(entry.quantity ?? entry.qty, 1))),
        unitPrice: money(entry.unitPrice ?? entry.price),
      };
    })
    .filter((item) => item.title);

  return {
    version: 1,
    channel: text(value.channel, text(fallback?.channel, "Default Channel")).slice(0, 100),
    orderReference: text(value.orderReference, text(fallback?.orderReference)).slice(0, 120),
    orderDate: text(value.orderDate, text(fallback?.orderDate, new Date().toISOString())),
    shippingMode:
      text(
        value.shippingMode,
        text(
          fallback?.shippingMode,
          process.env.NEXT_PUBLIC_DELHIVERY_SHIPPING_MODE ||
            process.env.DELHIVERY_SHIPPING_MODE ||
            "Surface",
        ),
      ).toLowerCase() === "express"
        ? "Express"
        : "Surface",
    paymentMode:
      text(value.paymentMode, text(fallback?.paymentMode, "Prepaid")).toUpperCase() === "COD"
        ? "COD"
        : "Prepaid",
    packageType: text(
      value.packageType,
      text(
        fallback?.packageType,
        process.env.NEXT_PUBLIC_DELHIVERY_PACKAGE_TYPE ||
          process.env.DELHIVERY_PACKAGE_TYPE ||
          "Cardboard Box",
      ),
    ).slice(0, 80),
    boxes,
    fragile: Boolean(value.fragile ?? fallback?.fragile),
    invoiceTotal: money(value.invoiceTotal ?? fallback?.invoiceTotal),
    collectableAmount: money(value.collectableAmount ?? fallback?.collectableAmount),
    items,
    notes: text(value.notes, text(fallback?.notes)).slice(0, 500),
    confirmed: Boolean(value.confirmed ?? fallback?.confirmed ?? true),
  };
}

export function calculateDelhiveryPackageMetrics(
  boxes: DelhiveryBox[],
): DelhiveryPackageMetrics {
  const calculated = boxes.map((box) => {
    const safeBox = normalizeDelhiveryBox(box);
    const volumetricWeightGrams = Math.round(
      (safeBox.lengthCm * safeBox.widthCm * safeBox.heightCm) /
        DELHIVERY_VOLUMETRIC_DIVISOR,
    );
    return {
      ...safeBox,
      volumetricWeightGrams,
      chargeableWeightGrams: Math.max(
        safeBox.weightGrams,
        volumetricWeightGrams,
      ),
    };
  });
  return {
    boxes: calculated,
    actualWeightGrams: calculated.reduce((sum, box) => sum + box.weightGrams, 0),
    volumetricWeightGrams: calculated.reduce(
      (sum, box) => sum + box.volumetricWeightGrams,
      0,
    ),
    chargeableWeightGrams: calculated.reduce(
      (sum, box) => sum + box.chargeableWeightGrams,
      0,
    ),
  };
}



export function buildDelhiveryDetailsFromOrder(
  order: Record<string, unknown>,
  input?: unknown,
): DelhiveryShipmentDetails {
  const customer =
    order.customer && typeof order.customer === "object"
      ? (order.customer as Record<string, unknown>)
      : {};
  const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
  const items = lineItems.map((item) => {
    const entry = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const price = entry.price && typeof entry.price === "object"
      ? (entry.price as Record<string, unknown>)
      : {};
    return {
      title: text(entry.title, "Product"),
      sku: text(entry.productId ?? entry.id),
      quantity: Math.max(1, Math.round(numeric(entry.quantity, 1))),
      unitPrice: money(price.amount ?? entry.price),
    };
  });
  const total = money(order.total ?? order.totalPrice ?? order.currentTotalPrice);
  const paymentMode = text(order.paymentMode, "prepaid").toLowerCase().startsWith("cod")
    ? "COD"
    : "Prepaid";
  const paymentReceived = money(order.paymentReceived ?? order.payableAmount ?? order.amountPaid);
  const collectableAmount = paymentMode === "COD"
    ? Number(Math.max(0, total - paymentReceived).toFixed(2))
    : 0;
  const existing = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const orderReference = String(order.orderNumber ?? order.id ?? "ORDER");

  return normalizeDelhiveryDetails(
    {
      ...existing,
      orderReference: text(existing.orderReference, orderReference),
      orderDate: text(existing.orderDate, text(order.createdAt ?? order.processedAt)),
      paymentMode,
      invoiceTotal: total,
      collectableAmount,
      items,
      confirmed: existing.confirmed ?? true,
    },
    {
      orderReference,
      orderDate: text(order.createdAt ?? order.processedAt),
      paymentMode,
      invoiceTotal: total,
      collectableAmount,
      items,
      confirmed: true,
    },
  );
}

export function validateDelhiveryDetails(input: {
  order: Record<string, unknown>;
  details: DelhiveryShipmentDetails;
  requireCompanyDetails?: boolean;
  requireConfirmed?: boolean;
  company?: Partial<DelhiveryCompanyDetails>;
}): string[] {
  const { order, details, company = {} } = input;
  const customer =
    order.customer && typeof order.customer === "object"
      ? (order.customer as Record<string, unknown>)
      : {};
  const errors: string[] = [];
  const recipientName = text(customer.fullName ?? order.customerName);
  const recipientPhone = phone(customer.phone ?? order.customerPhone ?? order.phone);
  const address = [customer.address1 ?? customer.address, customer.address2, customer.landmark]
    .map((part) => text(part))
    .filter(Boolean)
    .join(", ");
  const destinationPin = pincode(customer.pincode ?? customer.zip ?? order.pincode ?? order.zip);

  if (!details.orderReference) errors.push("Order reference is required.");
  if (!details.orderDate) errors.push("Order date is required.");
  if (!details.items.length) errors.push("At least one product item is required.");
  if (input.requireConfirmed !== false && !details.confirmed) {
    errors.push("Confirm the packed measurements before creating a shipment.");
  }
  if (!details.boxes.length || details.boxes.length > DELHIVERY_MAX_BOXES) {
    errors.push(`Box count must be between 1 and ${DELHIVERY_MAX_BOXES}.`);
  }
  if (details.boxes.some((box) => box.lengthCm <= 0 || box.widthCm <= 0 || box.heightCm <= 0)) {
    errors.push("Every box must have valid length, width, and height.");
  }
  if (details.boxes.some((box) => box.weightGrams <= 0)) {
    errors.push("Every box must have a valid actual weight.");
  }
  if (!recipientName) errors.push("Recipient name is missing.");
  if (!/^\d{10,15}$/.test(recipientPhone)) errors.push("Recipient phone must contain 10 to 15 digits.");
  if (!address) errors.push("Recipient address is missing.");
  if (!text(customer.city ?? order.city)) errors.push("Recipient city is missing.");
  if (!text(customer.state ?? customer.province ?? order.state)) errors.push("Recipient state is missing.");
  if (!/^\d{6}$/.test(destinationPin)) errors.push("Recipient pincode must contain 6 digits.");
  if (details.paymentMode === "COD" && details.collectableAmount <= 0) {
    errors.push("COD shipments require a collectable amount greater than zero.");
  }

  if (input.requireCompanyDetails) {
    if (!text(company.pickupLocation)) errors.push("The registered Delhivery pickup location is missing.");
    if (!/^\d{6}$/.test(normalizeDelhiveryPincode(company.pickupPincode || company.pincode))) {
      errors.push("The registered Delhivery pickup pincode must contain 6 digits.");
    }
    if (!text(company.name)) errors.push("Seller name is missing.");
    if (!text(company.hsnCode)) errors.push("HSN code is required for Delhivery commercial shipment creation.");
    if (details.invoiceTotal >= 50000) {
      errors.push(
        "Orders valued at INR 50,000 or more require additional e-waybill fields not configured in this integration; prepare this shipment manually or extend the payload first.",
      );
    }
  }
  return [...new Set(errors)];
}

export function getDelhiveryServiceabilityMessage(input: {
  serviceable: boolean;
  paymentServiceable: boolean;
  paymentMode: DelhiveryPaymentMode;
  pincode: string;
  city?: string;
  district?: string;
  state?: string;
  maxWeightGrams?: number;
  maxAmount?: number;
  chargeableWeightGrams?: number;
  collectableAmount?: number;
}): string {
  const location = [input.city, input.district, input.state].filter(Boolean).join(", ");
  if (!input.serviceable) return `Delhivery does not currently service ${input.pincode}.`;
  if (!input.paymentServiceable) {
    return `${input.paymentMode} delivery is not available for ${input.pincode}.`;
  }
  if (
    input.paymentMode === "COD" &&
    input.maxAmount &&
    input.collectableAmount &&
    input.maxAmount < input.collectableAmount
  ) {
    return `The COD amount exceeds Delhivery's serviceability limit for ${input.pincode}.`;
  }
  if (
    input.maxWeightGrams &&
    input.chargeableWeightGrams &&
    input.maxWeightGrams < input.chargeableWeightGrams
  ) {
    return `The package chargeable weight exceeds Delhivery's serviceability limit for ${input.pincode}.`;
  }
  return location
    ? `${input.paymentMode} delivery is available for ${input.pincode} (${location}).`
    : `${input.paymentMode} delivery is available for ${input.pincode}.`;
}

export function buildDelhiveryCreatePayload(input: {
  order: Record<string, unknown>;
  company: DelhiveryCompanyDetails;
  clientName: string;
  details: DelhiveryShipmentDetails;
  waybills?: string[];
}): Record<string, unknown> {
  const { order, company, clientName, details, waybills = [] } = input;
  const customer =
    order.customer && typeof order.customer === "object"
      ? (order.customer as Record<string, unknown>)
      : {};
  const metrics = calculateDelhiveryPackageMetrics(details.boxes);
  const address = [customer.address1 ?? customer.address, customer.address2, customer.landmark]
    .map((part) => text(part))
    .filter(Boolean)
    .join(", ");
  const total = money(details.invoiceTotal);
  const orderDate = new Date(details.orderDate);
  const safeOrderDate = Number.isNaN(orderDate.getTime())
    ? new Date().toISOString().slice(0, 19).replace("T", " ")
    : orderDate.toISOString().slice(0, 19).replace("T", " ");
  const totalChargeableWeight = metrics.chargeableWeightGrams || 1;
  let remainingInvoice = total;
  let remainingCollectable = money(details.collectableAmount);
  const boxAmounts = metrics.boxes.map((box, index) => {
    if (index === metrics.boxes.length - 1) {
      const amount = { invoice: remainingInvoice, collectable: remainingCollectable };
      remainingInvoice = 0;
      remainingCollectable = 0;
      return amount;
    }
    const invoice = Number((total * (box.chargeableWeightGrams / totalChargeableWeight)).toFixed(2));
    const collectable = Number(
      (money(details.collectableAmount) * (box.chargeableWeightGrams / totalChargeableWeight)).toFixed(2),
    );
    remainingInvoice = Number((remainingInvoice - invoice).toFixed(2));
    remainingCollectable = Number((remainingCollectable - collectable).toFixed(2));
    return { invoice, collectable };
  });

  const shipments = metrics.boxes.map((box, index) => ({
    name: text(customer.fullName ?? order.customerName, "Customer"),
    add: address,
    city: text(customer.city ?? order.city),
    state: text(customer.state ?? customer.province ?? order.state),
    country: text(customer.country ?? order.country, "India"),
    pin: pincode(customer.pincode ?? customer.zip ?? order.pincode ?? order.zip),
    phone: phone(customer.phone ?? order.customerPhone ?? order.phone),
    email: text(customer.email ?? order.emailLower),
    order: metrics.boxes.length > 1 ? `${details.orderReference}-B${index + 1}` : details.orderReference,
    ...(waybills[index] ? { waybill: waybills[index] } : {}),
    order_date: safeOrderDate,
    address_type: "home",
    payment_mode: details.paymentMode,
    cod_amount: boxAmounts[index].collectable,
    total_amount: boxAmounts[index].invoice,
    shipping_mode: details.shippingMode,
    weight: `${box.weightGrams} gm`,
    shipment_length: Math.round(box.lengthCm),
    shipment_width: Math.round(box.widthCm),
    shipment_height: Math.round(box.heightCm),
    package_type: details.packageType,
    fragile_shipment: details.fragile ? "true" : "false",
    products_desc: details.items.map((item) => item.title).join(", ").slice(0, 256),
    commodity_value: boxAmounts[index].invoice,
    quantity: details.items.reduce((sum, item) => sum + item.quantity, 0),
    seller_name: company.name,
    seller_add: [company.address, company.city, company.state, company.pincode]
      .filter(Boolean)
      .join(", "),
    hsn_code: company.hsnCode,
    ...(company.gstin ? { seller_gst_tin: company.gstin } : {}),
    client: clientName,
  }));

  return {
    client: clientName,
    pickup_location: {
      name: company.pickupLocation,
      city: company.city,
      pin_code: company.pickupPincode || company.pincode,
      country: company.country || "India",
      phone: company.phone,
      add: company.address,
    },
    fragile_shipment: details.fragile,
    shipments,
  };
}


export function buildDelhiveryManualHandoff(input: {
  company: DelhiveryCompanyDetails;
  details: DelhiveryShipmentDetails;
  order: Record<string, unknown>;
}): Record<string, string | number | boolean> {
  const { company, details, order } = input;
  const customer =
    order.customer && typeof order.customer === "object"
      ? (order.customer as Record<string, unknown>)
      : {};
  const metrics = calculateDelhiveryPackageMetrics(details.boxes);
  const recipientAddress = [
    customer.address1 ?? customer.address,
    customer.address2,
    customer.landmark,
  ]
    .map((part) => text(part))
    .filter(Boolean)
    .join(", ");
  return {
    "Company details — GSTIN": company.gstin,
    "Company details — PAN": company.pan,
    "Company details — Address": [company.address, company.city, company.state, company.pincode, company.country].filter(Boolean).join(", "),
    "Company details — Primary contact": `${company.contactName}, ${company.phone}, ${company.email}`,
    "Order details — Channel": details.channel,
    "Order details — Order ID/reference": details.orderReference,
    "Order details — Seller": company.name,
    "Order details — Pickup from": `${company.pickupLocation}, ${company.address}, ${company.city}, ${company.state}, ${company.pincode}`,
    "Product & box details — Packaging type": details.packageType,
    "Product & box details — Boxes": details.boxes.length,
    "Product & box details — Total actual weight (g)": metrics.actualWeightGrams,
    "Product & box details — Total volumetric weight (g)": metrics.volumetricWeightGrams,
    "Product & box details — Chargeable weight (g)": metrics.chargeableWeightGrams,
    "Product & box details — Fragile": details.fragile ? "Yes" : "No",
    ...Object.fromEntries(
      details.items.map((item, index) => [
        `Product item ${index + 1}`,
        `${item.title}; SKU ${item.sku || "—"}; qty ${item.quantity}; ${money(item.unitPrice)} each`,
      ]),
    ),
    ...Object.fromEntries(
      details.boxes.map((box, index) => [
        `Product & box details — Box ${index + 1}`,
        `${box.lengthCm} × ${box.widthCm} × ${box.heightCm} cm; ${box.weightGrams} g`,
      ]),
    ),
    "Order summary — Deliver to": `${text(customer.fullName ?? order.customerName)}, ${recipientAddress}, ${text(customer.city ?? order.city)}, ${text(customer.state ?? customer.province ?? order.state)}, ${pincode(customer.pincode ?? customer.zip)}`,
    "Order summary — Phone": phone(customer.phone),
    "Order summary — Email": text(customer.email ?? order.emailLower),
    "Order summary — Item count": details.items.reduce((sum, item) => sum + item.quantity, 0),
    "Order summary — Payment type": details.paymentMode,
    "Order summary — Product invoice total": money(details.invoiceTotal),
    "Order summary — Shipping method": details.shippingMode,
    "Order summary — Notes": details.notes,
  };
}


