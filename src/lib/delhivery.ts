import "server-only";

type DelhiveryTrackingPayload = {
  ShipmentData?: Array<{
    Shipment?: {
      Status?: { Status?: string; StatusLocation?: string; StatusDateTime?: string };
      Scans?: Array<{
        ScanDetail?: {
          Status?: string;
          StatusDescription?: string;
          Scan?: string;
        };
      }>;
      Scan?: Array<{
        ScanDetail?: {
          Status?: string;
          StatusDescription?: string;
          Scan?: string;
        };
      }>;
    };
  }>;
};

function normalizeStatus(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function buildDelhiveryUrl(waybill: string, token?: string): string {
  const url = new URL("https://track.delhivery.com/api/v1/packages/json/");
  url.searchParams.set("waybill", waybill);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

function extractShipmentStatus(payload: DelhiveryTrackingPayload | null): string | null {
  if (!payload || typeof payload !== "object") return null;
  const shipment = payload?.ShipmentData?.[0]?.Shipment;
  const scans = shipment?.Scans || shipment?.Scan;
  if (Array.isArray(scans) && scans.length > 0) {
    const last = scans[scans.length - 1]?.ScanDetail;
    const scanStatus =
      last?.Status || last?.StatusDescription || last?.Scan;
    if (typeof scanStatus === "string" && scanStatus.trim()) return scanStatus.trim();
  }

  const statusText = shipment?.Status?.Status;
  if (typeof statusText === "string" && statusText.trim()) return statusText.trim();

  return null;
}

function normalizeDelhiveryEvent(status: string): string | null {
  const normalized = normalizeStatus(status);
  if (normalized.includes("OUT_FOR_DELIVERY")) return "OUT_FOR_DELIVERY";
  if (normalized.includes("DELIVERED")) return "DELIVERED";
  if (
    normalized.includes("IN_TRANSIT") ||
    normalized.includes("ON_THE_WAY") ||
    normalized.includes("PACKAGE_LOADED") ||
    normalized.includes("IN_FACILITY") ||
    normalized.includes("REACHED_DESTINATION_CITY")
  ) {
    return "IN_TRANSIT";
  }
  if (normalized.includes("PICKED_UP")) return "CARRIER_PICKED_UP";
  if (normalized.includes("READY_FOR_PICKUP")) return "READY_FOR_PICKUP";
  return status.trim() ? status.trim() : null;
}

function shouldQueryDelhivery(company: string, trackingNumber: string): boolean {
  const companyNormalized = String(company || "").trim().toLowerCase();
  if (companyNormalized.includes("delhivery")) return true;
  return Boolean(trackingNumber);
}

export async function fetchDelhiveryTrackingEvent(input: {
  trackingNumber: string;
  company?: string;
}): Promise<string | null> {
  const trackingNumber = String(input.trackingNumber || "").trim();
  const company = String(input.company || "").trim();
  if (!trackingNumber) return null;
  if (!shouldQueryDelhivery(company, trackingNumber)) return null;

  const token = String(process.env.DELHIVERY_API_TOKEN || "").trim();
  const endpoints = token
    ? [buildDelhiveryUrl(trackingNumber, token), buildDelhiveryUrl(trackingNumber)]
    : [buildDelhiveryUrl(trackingNumber)];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent": "SucculentSphere/1.0 (+https://succulentsphere.com)",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        continue;
      }

      const raw = await response.text();
      let payload: DelhiveryTrackingPayload | null = null;
      try {
        payload = raw ? (JSON.parse(raw) as DelhiveryTrackingPayload) : null;
      } catch {
        payload = null;
      }
      if (!payload) continue;

      const status = extractShipmentStatus(payload);
      const normalized = status ? normalizeDelhiveryEvent(status) : null;
      if (normalized) return normalized;
    } catch {
      // ignore network/timeout errors
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}
