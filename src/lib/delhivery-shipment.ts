import { getOrderPaymentSummary } from "./orderAmounts";

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
  const result = String(value ?? "").replace(/[&#%;\\]/g, "").trim();
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
const waybill = (value: unknown) => {
  const result = String(value ?? "").trim();
  return /^[A-Za-z0-9]{10,}$/.test(result) ? result : "";
};

function lineItemQuantity(item: Record<string, unknown>) {
  return Math.max(1, Math.round(numeric(item.quantity ?? item.qty, 1)));
}

function orderLineItems(order: Record<string, unknown>) {
  return Array.isArray(order.lineItems)
    ? order.lineItems.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      )
    : [];
}


export function getDelhiveryOrderAmounts(
  order: Record<string, unknown>,
): {
  paymentMode: DelhiveryPaymentMode;
  invoiceTotal: number;
  collectableAmount: number;
  paidAmount: number;
  depositAmount: number;
} {
  const payment = getOrderPaymentSummary(order);
  return {
    paymentMode: payment.paymentMode,
    invoiceTotal: payment.grandTotal,
    collectableAmount: payment.codBalance,
    paidAmount: payment.paidAmount,
    depositAmount: payment.depositAmount,
  };
}

export function getConfirmedShipmentWaybills(
  order: Record<string, unknown>,
  job?: Record<string, unknown> | null,
): string[] {
  const fromTracking = Array.isArray(order.tracking)
    ? order.tracking
        .map((item) =>
          waybill(
            item && typeof item === "object"
              ? (item as Record<string, unknown>).number
              : item,
          ),
        )
        .filter(Boolean)
    : [];
  const orderWaybill = waybill(order.awb);
  const orderWaybills = [...new Set([...fromTracking, orderWaybill].filter(Boolean))];
  if (orderWaybills.length) return orderWaybills;

  const shipment = job && typeof job === "object" ? job : {};
  const shipmentIsConfirmed =
    shipment.status === "done" || shipment.fulfillmentStatus === "SHIPPED";
  if (!shipmentIsConfirmed) return [];

  const candidates = [
    ...(Array.isArray(shipment.waybills) ? shipment.waybills : []),
    ...(Array.isArray(shipment.trackingNumbers) ? shipment.trackingNumbers : []),
    shipment.trackingNumber,
    shipment.awb,
  ].map(waybill).filter(Boolean);
  return [...new Set(candidates)];
}

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
      [value.paymentMode, value.payment_method, fallback?.paymentMode]
        .map((item) => text(item).toUpperCase())
        .some((item) => item === "COD" || item === "CASH ON DELIVERY")
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
  const existing = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const amounts = getDelhiveryOrderAmounts(order);
  const orderReference = String(order.orderNumber ?? order.id ?? "ORDER");
  const productName = "Succulents";
  const productSku = "1001";
  const orderQuantity = orderLineItems(order).reduce(
    (sum, item) => sum + lineItemQuantity(item),
    0,
  );
  const aggregateQuantity = Math.max(1, orderQuantity);
  // Delhivery's single-piece manifest represents the whole physical parcel as
  // one SKU line. The product quantity is the total number of plants, while the
  // product/commodity value remains the complete order total.
  const items = [{
    title: productName,
    sku: productSku,
    quantity: aggregateQuantity,
    unitPrice: Number((amounts.invoiceTotal / aggregateQuantity).toFixed(2)),
  }];

  return normalizeDelhiveryDetails(
    {
      ...existing,
      orderReference,
      orderDate: text(existing.orderDate, text(order.createdAt ?? order.processedAt)),
      paymentMode: amounts.paymentMode,
      invoiceTotal: amounts.invoiceTotal,
      collectableAmount: amounts.collectableAmount,
      items,
      confirmed: existing.confirmed ?? true,
    },
    {
      orderReference,
      orderDate: text(order.createdAt ?? order.processedAt),
      paymentMode: amounts.paymentMode,
      invoiceTotal: amounts.invoiceTotal,
      collectableAmount: amounts.collectableAmount,
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
  const address = [customer.address1, customer.address2]
    .map((part) => text(part))
    .filter(Boolean)
    .join(", ") || text(customer.address);
  const destinationPin = pincode(customer.pincode ?? customer.zip ?? order.pincode ?? order.zip);

  if (!details.orderReference) errors.push("Order reference is required.");
  if (!details.orderDate) errors.push("Order date is required.");
  if (!details.items.length) errors.push("At least one product item is required.");
  if (details.invoiceTotal <= 0) errors.push("Order grand total must be greater than zero.");
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
  orderId: string;
  details: DelhiveryShipmentDetails;
  company?: Partial<DelhiveryCompanyDetails>;
  /** Overrides the `order`/`seller_inv` reference, e.g. "1009(2)" for a repeat shipment. */
  orderReference?: string;
}): {
  shipments: Array<{
    name: string;
    add: string;
    pin: string;
    city: string;
    state: string;
    country: string;
    phone: string;
    order: string;
    order_date: string;
    payment_mode: DelhiveryPaymentMode;
    cod_amount: number;
    total_amount: number;
    commodity_value: number;
    products_desc: string;
    quantity: string;
    seller_name: string;
    seller_add: string;
    seller_inv: string;
    hsn_code: string;
    seller_gst_tin?: string;
    shipment_length: number;
    shipment_width: number;
    shipment_height: number;
    weight: string;
    package_type: string;
    fragile_shipment: string;
    shipping_mode: string;
    address_type: string;
    client: string;
  }>;
  pickup_location: { name: string };
} {
  const { order, orderId, details, company = {} } = input;
  const customer =
    order.customer && typeof order.customer === "object"
      ? (order.customer as Record<string, unknown>)
      : {};
  const address =
    [customer.address1, customer.address2]
      .map((part) => text(part))
      .filter(Boolean)
      .join(", ") || text(customer.address);
  const amounts = getDelhiveryOrderAmounts(order);
  const normalizedDetails = buildDelhiveryDetailsFromOrder(order, details);
  const box = normalizedDetails.boxes[0] || defaultBox();
  const totalAmount = amounts.invoiceTotal || money(normalizedDetails.invoiceTotal);
  const collectableAmount = amounts.paymentMode === "COD" ? amounts.collectableAmount : 0;
  const orderReference =
    text(input.orderReference) ||
    String(
      order.orderNumber ?? order.id ?? normalizedDetails.orderReference ?? orderId ?? "",
    );
  const orderDateValue = new Date(
    normalizedDetails.orderDate || text(order.createdAt) || text(order.processedAt) || Date.now(),
  );
  const orderDate = Number.isNaN(orderDateValue.getTime())
    ? new Date().toISOString().slice(0, 19).replace("T", " ")
    : orderDateValue.toISOString().slice(0, 19).replace("T", " ");
  const sellerName = text(company.name, "Succulent Sphere");
  const sellerAddress = [
    text(company.address, text(process.env.DELHIVERY_SELLER_ADDRESS)),
    text(company.city, "Bhimtal"),
    text(company.state, "Uttarakhand"),
    text(company.pincode, "263136"),
  ]
    .filter(Boolean)
    .join(", ");
  const product = normalizedDetails.items[0];
  const productDescription = text(product?.title, "Succulents");

  return {
    shipments: [
      {
        name: text(customer.fullName ?? order.customerName, "Customer"),
        add: address,
        pin: pincode(customer.pincode ?? customer.zip),
        city: text(customer.city ?? order.city),
        state: text(customer.state ?? customer.province ?? order.state),
        country: "India",
        phone: phone(customer.phone ?? order.customerPhone ?? order.phone),
        order: orderReference,
        order_date: orderDate,
        payment_mode: amounts.paymentMode,
        cod_amount: collectableAmount,
        total_amount: totalAmount,
        commodity_value: totalAmount,
        products_desc: productDescription,
        quantity: String(product?.quantity || 1),
        seller_name: sellerName,
        seller_add: sellerAddress,
        seller_inv: orderReference,
        hsn_code: text(company.hsnCode ?? process.env.DELHIVERY_HSN_CODE),
        ...(text(company.gstin ?? process.env.DELHIVERY_SELLER_GST_TIN)
          ? { seller_gst_tin: text(company.gstin ?? process.env.DELHIVERY_SELLER_GST_TIN) }
          : {}),
        shipment_length: Math.round(box.lengthCm),
        shipment_width: Math.round(box.widthCm),
        shipment_height: Math.round(box.heightCm),
        weight: `${Math.round(box.weightGrams)} gm`,
        package_type: normalizedDetails.packageType,
        fragile_shipment: normalizedDetails.fragile ? "true" : "false",
        shipping_mode: normalizedDetails.shippingMode,
        address_type: "home",
        client: "e3ac15-SucculentSphere-do",
      },
    ],
    pickup_location: {
      name: "Succulent Sphere",
    },
  };
}


export type DelhiveryManifestEditPayload = {
  waybill: string;
  /** Delhivery's Edit API requires decimals; integers are rejected as "voll must be an instance of float". */
  shipment_length: string;
  shipment_width: string;
  shipment_height: string;
  cod: string;
  gm: string;
  name: string;
  add: string;
  product_details: string;
  pt: DelhiveryPaymentMode;
};

export function buildDelhiveryManifestEditPayload(input: {
  order: Record<string, unknown>;
  orderId: string;
  awb: string;
  details: DelhiveryShipmentDetails;
}): DelhiveryManifestEditPayload {
  const { order, awb, details } = input;
  const customer =
    order.customer && typeof order.customer === "object"
      ? (order as Record<string, unknown>).customer as Record<string, unknown>
      : {};
  const address =
    [customer.address1, customer.address2]
      .map((part) => text(part))
      .filter(Boolean)
      .join(", ") || text(customer.address);
  const normalizedDetails = buildDelhiveryDetailsFromOrder(order, details);
  const box = normalizedDetails.boxes[0] || defaultBox();
  const amounts = getDelhiveryOrderAmounts(order);
  const product = normalizedDetails.items[0];
  const productName = text(product?.title, "Succulents");
  const quantity = Math.max(1, product?.quantity || 1);
  const grandTotal = amounts.invoiceTotal;
  const tracking = Array.isArray(order.tracking) ? order.tracking : [];
  const trackingRecord =
    tracking[0] && typeof tracking[0] === "object"
      ? (tracking[0] as Record<string, unknown>)
      : {};
  const validWaybill = waybill(String(
    order.awb || trackingRecord.number || awb,
  ));
  if (!validWaybill) {
    throw new Error("A valid Delhivery AWB is required before updating the manifest.");
  }

  // Delhivery's Edit endpoint validates the derived volumetric weight as a
  // float. Integer JSON values make it compute an int and reject the request
  // with "voll must be an instance of float not int", so every numeric field is
  // sent with an explicit decimal representation.
  const decimal = (value: number) => Number(value).toFixed(2);
  return {
    waybill: validWaybill,
    shipment_length: decimal(box.lengthCm),
    shipment_width: decimal(box.widthCm),
    shipment_height: decimal(box.heightCm),
    cod: decimal(amounts.paymentMode === "COD" ? amounts.collectableAmount : 0),
    gm: decimal(box.weightGrams),
    name: text(customer.fullName ?? order.customerName, "Customer"),
    add: address,
    product_details: `${productName} | Quantity: ${quantity} | Total price: INR ${grandTotal.toFixed(2)}`,
    pt: amounts.paymentMode,
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


