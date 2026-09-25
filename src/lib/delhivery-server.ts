import "server-only";

import {
  buildDelhiveryCreatePayload,
  buildDelhiveryManifestEditPayload,
  calculateDelhiveryPackageMetrics,
  getDelhiveryServiceabilityMessage,
  normalizeDelhiveryDetails,
  normalizeDelhiveryPincode,
  type DelhiveryCompanyDetails,
  type DelhiveryPaymentMode,
  type DelhiveryRateQuote,
  type DelhiveryServiceability,
  type DelhiveryShipmentDetails,
} from "@/lib/delhivery-shipment";
import { resolveDelhiveryStateName } from "@/lib/delhiveryTracking";

export type DelhiveryCreateResult = {
  waybills: string[];
  packageResults: Array<Record<string, unknown>>;
  raw: Record<string, unknown>;
};

export type DelhiveryApiMode = "production" | "staging";

export function getDelhiveryApiMode(): DelhiveryApiMode {
  return String(process.env.DELHIVERY_MODE || "production").trim().toLowerCase() === "staging"
    ? "staging"
    : "production";
}

export function getDelhiveryEndpointMode(): DelhiveryApiMode {
  return getDelhiveryCreateUrl().includes("staging-express.delhivery.com")
    ? "staging"
    : "production";
}

export function getDelhiveryCreateUrl() {
  const configuredMode = String(process.env.DELHIVERY_MODE || "")
    .trim()
    .toLowerCase();
  if (configuredMode === "staging") {
    return "https://staging-express.delhivery.com/api/cmu/create.json";
  }
  if (configuredMode === "production") {
    return "https://track.delhivery.com/api/cmu/create.json";
  }
  return (
    String(process.env.DELHIVERY_CREATE_URL || "").trim() ||
    "https://track.delhivery.com/api/cmu/create.json"
  );
}

export function getDelhiveryEditUrl() {
  const configuredMode = String(process.env.DELHIVERY_MODE || "")
    .trim()
    .toLowerCase();
  if (configuredMode === "staging") {
    return "https://staging-express.delhivery.com/api/p/edit";
  }
  if (configuredMode === "production") {
    return "https://track.delhivery.com/api/p/edit";
  }
  return (
    String(process.env.DELHIVERY_EDIT_URL || "").trim() ||
    "https://track.delhivery.com/api/p/edit"
  );
}

const config = {
  apiToken: () => String(process.env.DELHIVERY_API_TOKEN || "").trim(),
  createUrl: getDelhiveryCreateUrl,
  editUrl: getDelhiveryEditUrl,
  serviceabilityUrl: () =>
    String(
      process.env.DELHIVERY_SERVICEABILITY_URL ||
        "https://track.delhivery.com/c/api/pin-codes/json/",
    ).trim(),
  rateUrl: () =>
    String(
      process.env.DELHIVERY_RATE_URL ||
        "https://track.delhivery.com/api/kinko/v1/invoice/charges/.json",
    ).trim(),
  clientName: () =>
    "e3ac15-SucculentSphere-do",
};

export function getDelhiveryCompanyDetails(): DelhiveryCompanyDetails {
  const packagesPerMonth = Number(process.env.DELHIVERY_PACKAGES_PER_MONTH);
  return {
    name: String(process.env.DELHIVERY_SELLER_NAME || "Succulent Sphere").trim(),
    gstin: String(process.env.DELHIVERY_SELLER_GST_TIN || "").trim().toUpperCase(),
    pan: String(process.env.DELHIVERY_SELLER_PAN || "").trim().toUpperCase(),
    address: String(
      process.env.DELHIVERY_SELLER_ADDRESS ||
        process.env.DELHIVERY_PICKUP_LOCATION ||
        "",
    ).trim(),
    city: String(process.env.DELHIVERY_SELLER_CITY || "Bhimtal").trim(),
    state: String(process.env.DELHIVERY_SELLER_STATE || "Uttarakhand").trim(),
    pincode: normalizeDelhiveryPincode(
      process.env.DELHIVERY_SELLER_PINCODE || "263136",
    ),
    country: String(process.env.DELHIVERY_SELLER_COUNTRY || "India").trim(),
    contactName: String(process.env.DELHIVERY_CONTACT_NAME || "Harshit Pathak").trim(),
    phone: String(process.env.DELHIVERY_CONTACT_PHONE || "9458321209").trim(),
    email: String(
      process.env.DELHIVERY_CONTACT_EMAIL || "succulentsphere@gmail.com",
    ).trim().toLowerCase(),
    packagesPerMonth: Number.isFinite(packagesPerMonth)
      ? Math.max(0, Math.round(packagesPerMonth))
      : 200,
    pickupLocation: String(process.env.DELHIVERY_PICKUP_LOCATION || "").trim(),
    pickupPincode: normalizeDelhiveryPincode(
      process.env.DELHIVERY_PICKUP_PINCODE ||
        process.env.DELHIVERY_SELLER_PINCODE ||
        "263136",
    ),
    logoUrl: String(process.env.DELHIVERY_LOGO_URL || "").trim(),
    hsnCode: String(process.env.DELHIVERY_HSN_CODE || "").trim(),
  };
}

export function isDelhiveryApiConfigured() {
  return Boolean(config.apiToken() && config.createUrl() && config.clientName());
}

export function getDelhiveryAdminConfig() {
  return {
    configured: isDelhiveryApiConfigured(),
    mode: getDelhiveryEndpointMode(),
    createUrl: config.createUrl(),
    clientNameConfigured: Boolean(config.clientName()),
    dashboardUrl: String(
      process.env.DELHIVERY_DASHBOARD_URL || "https://client.delhivery.com/",
    ).trim(),
  };
}

function requestTimeoutMs() {
  return Math.max(5000, Number(process.env.DELHIVERY_REQUEST_TIMEOUT_MS || 25000));
}

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const value = payload as Record<string, unknown>;
  const exactMessage = [value.rmk, value.message, value.detail, value.error]
    .find((item) => typeof item === "string" && item.trim());
  if (exactMessage) return String(exactMessage).trim();
  const packages = Array.isArray(value.packages) ? value.packages : [];
  for (const item of packages) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const remark = String(entry.remarks || entry.error || "").trim();
    if (remark) return remark;
  }
  return fallback;
}

async function carrierFetch(url: string, init: RequestInit = {}) {
  const token = config.apiToken();
  if (!token) {
    throw new Error(
      "Delhivery API is not configured. Add DELHIVERY_API_TOKEN on the server.",
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs());
  try {
    const outgoingHeaders = {
      Accept: "application/json,text/plain,*/*",
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
      ...(init.headers || {}),
    };
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: outgoingHeaders,
    });
    const raw = await response.text();
    let payload: unknown = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = { raw };
    }
    if (!response.ok) {
      console.error("Delhivery API Error:", payload);
      throw new Error(
        errorMessage(payload, `Delhivery request failed (${response.status}).`),
      );
    }
    return payload;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Delhivery did not respond before the request timeout.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function waybillCandidates(payload: unknown): string[] {
  const values: unknown[] = [];
  if (Array.isArray(payload)) values.push(...payload);
  else if (typeof payload === "string" || typeof payload === "number") values.push(payload);
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    for (const key of ["waybills", "waybill", "data", "result", "raw"]) {
      if (Array.isArray(root[key])) values.push(...(root[key] as unknown[]));
      else if (root[key] != null) values.push(root[key]);
    }
  }
  return [
    ...new Set(
      values
        .flatMap((value) => String(value).match(/\b\d{10,}\b/g) || [])
        .map((value) => value.trim()),
    ),
  ];
}

export async function allocateDelhiveryWaybills(count: number): Promise<string[]> {
  const safeCount = Math.max(1, Math.min(5, Math.round(count)));
  const url = new URL(
    String(
      process.env.DELHIVERY_WAYBILL_URL ||
        "https://track.delhivery.com/waybill/api/bulk/json/",
    ),
  );
  url.searchParams.set("token", config.apiToken());
  url.searchParams.set("client_name", config.clientName());
  url.searchParams.set("action", "next");
  url.searchParams.set("count", String(safeCount));
  const payload = await carrierFetch(url.toString());
  const waybills = waybillCandidates(payload);
  if (waybills.length !== safeCount) {
    throw new Error(
      errorMessage(
        payload,
        `Delhivery allocated ${waybills.length} of ${safeCount} requested AWBs.`,
      ),
    );
  }
  return waybills;
}


function firstRateRecord(payload: unknown): Record<string, unknown> {
  if (Array.isArray(payload)) return (payload[0] || {}) as Record<string, unknown>;
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    if (Array.isArray(value.data)) return (value.data[0] || {}) as Record<string, unknown>;
    return value;
  }
  return {};
}

function amount(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? Number(result.toFixed(2)) : 0;
}

export async function checkDelhiveryServiceability(input: {
  pincode: string;
  paymentMode: DelhiveryPaymentMode;
  chargeableWeightGrams?: number;
  collectableAmount?: number;
}): Promise<DelhiveryServiceability> {
  const destinationPin = normalizeDelhiveryPincode(input.pincode);
  if (!/^\d{6}$/.test(destinationPin)) {
    throw new Error("Enter a valid 6-digit destination pincode.");
  }
  const url = new URL(config.serviceabilityUrl());
  url.searchParams.set("filter_codes", destinationPin);
  const payload = await carrierFetch(url.toString());
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const rawEntries = Array.isArray(root.delivery_codes)
    ? root.delivery_codes
    : Array.isArray(root.pin_codes)
      ? root.pin_codes
      : [];
  const first = (rawEntries[0] || {}) as Record<string, unknown>;
  const entry =
    first.postal_code && typeof first.postal_code === "object"
      ? (first.postal_code as Record<string, unknown>)
      : first;
  const serviceable = rawEntries.length > 0;
  const prepaid = String(entry.pre_paid || "").toUpperCase() === "Y";
  const cod = ["cod", "cash"].some(
    (key) => String(entry[key] || "").toUpperCase() === "Y",
  );
  const paymentServiceable =
    serviceable &&
    (input.paymentMode === "COD" ? cod : entry.pre_paid ? prepaid : true);
  const maxWeightGrams = Math.max(0, Number(entry.max_weight || 0));
  const city = String(entry.city || "").trim();
  const district = String(entry.district || "").trim();
  // Delhivery usually returns only a state code (UK, DL, ...), so expand it to
  // the full name that Delhivery's create manifest expects.
  const state = resolveDelhiveryStateName(entry.state || entry.state_code);
  const sortCode = String(entry.sort_code || "").trim();
  const result = {
    serviceable,
    paymentServiceable,
    pincode: destinationPin,
    city,
    district,
    state,
    sortCode,
    maxWeightGrams,
    maxAmount: Math.max(0, Number(entry.max_amount || 0)),
    checkedAt: new Date().toISOString(),
  };
  return {
    ...result,
    message: getDelhiveryServiceabilityMessage({
      ...result,
      paymentMode: input.paymentMode,
      chargeableWeightGrams: input.chargeableWeightGrams,
      collectableAmount: input.collectableAmount,
    }),
  };
}

export async function getDelhiveryRateQuote(input: {
  company: DelhiveryCompanyDetails;
  destinationPincode: string;
  mode: "Surface" | "Express";
  chargeableWeightGrams: number;
}): Promise<DelhiveryRateQuote> {
  const destinationPin = normalizeDelhiveryPincode(input.destinationPincode);
  const originPin = normalizeDelhiveryPincode(
    input.company.pickupPincode || input.company.pincode,
  );
  if (!/^\d{6}$/.test(destinationPin) || !/^\d{6}$/.test(originPin)) {
    throw new Error("Origin and destination pincodes are required for a rate quote.");
  }
  if (input.chargeableWeightGrams <= 0) {
    throw new Error("Chargeable weight must be greater than zero.");
  }
  const url = new URL(config.rateUrl());
  url.searchParams.set("md", input.mode === "Express" ? "E" : "S");
  url.searchParams.set("cgm", String(Math.ceil(input.chargeableWeightGrams)));
  url.searchParams.set("o_pin", originPin);
  url.searchParams.set("d_pin", destinationPin);
  url.searchParams.set("ss", "Delivered");
  const payload = await carrierFetch(url.toString(), {
    headers: { "Content-Type": "application/json" },
  });
  const record = firstRateRecord(payload);
  const total = amount(record.total_amount ?? record.gross_amount);
  if (!total) {
    throw new Error(
      errorMessage(payload, "Delhivery did not return a shipping charge for this route."),
    );
  }
  return {
    mode: input.mode,
    amount: total,
    grossAmount: amount(record.gross_amount),
    codAmount: amount(record.charge_COD),
    freightAmount: amount(record.charge_DL),
    fuelSurcharge: amount(record.charge_FS),
    zone: String(record.zone || "").trim(),
    chargeableWeightGrams: Math.ceil(input.chargeableWeightGrams),
    approximate: true,
    raw: record,
  };
}

function collectPackageResults(payload: unknown): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  if (Array.isArray(root.packages)) {
    return root.packages.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object",
    );
  }
  if (Array.isArray(root.response)) {
    return root.response.flatMap((item) => collectPackageResults(item));
  }
  if (root.package && typeof root.package === "object") {
    return collectPackageResults(root.package);
  }
  return [];
}

function packageWaybill(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const item = value as Record<string, unknown>;
  const waybill = String(
    item.waybill || item.awb || item.waybill_number || item.awb_number || "",
  ).trim();
  return /^[A-Za-z0-9]{10,}$/.test(waybill) ? waybill : "";
}

function responseWaybill(value: unknown) {
  const waybill = String(value || "").trim();
  return /^[A-Za-z0-9]{10,}$/.test(waybill) ? waybill : "";
}

export async function createDelhiveryShipment(input: {
  order: Record<string, unknown>;
  orderId: string;
  details: DelhiveryShipmentDetails;
  /** Distinct reference for a repeat shipment, e.g. "1009(2)". */
  orderReference?: string;
}): Promise<DelhiveryCreateResult> {
  const clientName = config.clientName();
  if (!clientName) {
    throw new Error(
      "DELHIVERY_CLIENT_NAME is required and must exactly match the registered Delhivery account name.",
    );
  }
  const payload = buildDelhiveryCreatePayload({
    order: input.order,
    orderId: input.orderId,
    details: normalizeDelhiveryDetails(input.details),
    company: getDelhiveryCompanyDetails(),
    ...(input.orderReference ? { orderReference: input.orderReference } : {}),
  });
  const data = encodeURIComponent(JSON.stringify(payload));
  const raw = await carrierFetch(config.createUrl(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Token ${config.apiToken()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `format=json&data=${data}`,
  });
  const response = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (response.success === false || response.error === true || response.rmk) {
    console.error("Delhivery API Error:", response);
    throw new Error(errorMessage(raw, "Delhivery rejected the shipment creation request."));
  }
  const packageResults = collectPackageResults(raw);
  const rootWaybillValue = response.upload_wbn || response.waybill || response.awb;
  const waybills = [
    ...packageResults
    .map((item) => packageWaybill(item))
    .filter(Boolean),
    ...(rootWaybillValue ? [responseWaybill(rootWaybillValue)].filter(Boolean) : []),
  ];
  const uniqueWaybills = [...new Set(waybills)];
  if (!uniqueWaybills.length) {
    throw new Error(errorMessage(raw, "Delhivery did not return a waybill. The order was not marked as shipped."));
  }
  return { waybills: uniqueWaybills, packageResults, raw: response };
}

export type DelhiveryEditResult = {
  waybill: string;
  orderId: string | null;
  raw: Record<string, unknown>;
  payload: ReturnType<typeof buildDelhiveryManifestEditPayload>;
};

export async function editDelhiveryShipment(input: {
  order: Record<string, unknown>;
  orderId: string;
  awb: string;
  details: DelhiveryShipmentDetails;
}): Promise<DelhiveryEditResult> {
  const payload = buildDelhiveryManifestEditPayload({
    order: input.order,
    orderId: input.orderId,
    awb: input.awb,
    details: normalizeDelhiveryDetails(input.details),
  });
  const raw = await carrierFetch(config.editUrl(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Token ${config.apiToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const response = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (response.status !== true || response.error) {
    console.error("Delhivery API Error:", response);
    throw new Error(
      errorMessage(raw, "Delhivery rejected the shipment manifest update."),
    );
  }
  const responseWaybill = String(response.waybill || payload.waybill).trim();
  if (!/^[A-Za-z0-9]{10,}$/.test(responseWaybill)) {
    throw new Error("Delhivery did not return the updated AWB.");
  }
  return {
    waybill: responseWaybill,
    orderId: response.order_id == null ? null : String(response.order_id),
    raw: response,
    payload,
  };
}

