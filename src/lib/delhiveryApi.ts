export type ReadyToShipJob = {
  status?: string;
  attempts?: number;
  lastError?: string;
  trackingNumber?: string;
  trackingNumbers?: string[];
  [key: string]: unknown;
};

export type ManifestUpdateResponse = {
  ok: boolean;
  waybill: string;
  trackingNumber: string;
  trackingUrl: string;
  result?: Record<string, unknown>;
  job?: ReadyToShipJob | null;
  workspace?: Record<string, unknown>;
  error?: string;
};

export type ReadyToShipResponse = {
  ok: boolean;
  skipped?: boolean;
  additional?: boolean;
  needsConfirmation?: boolean;
  orderReference?: string;
  sequence?: number;
  allWaybills?: string[];
  result?: {
    reason?: string;
    waybills?: string[];
    [key: string]: unknown;
  };
  waybills?: string[];
  trackingNumber?: string;
  trackingUrl?: string;
  job?: ReadyToShipJob | null;
  workspace?: Record<string, unknown>;
  error?: string;
};

export class DelhiveryApiError extends Error {
  payload: ReadyToShipResponse | ManifestUpdateResponse;

  constructor(message: string, payload: ReadyToShipResponse) {
    super(message);
    this.name = "DelhiveryApiError";
    this.payload = payload;
  }
}

export async function createReadyToShipOrder(
  orderId: string,
  options: { additional?: boolean } = {},
): Promise<ReadyToShipResponse> {
  const id = String(orderId || "").trim();
  if (!id) throw new Error("Order id is required.");

  const response = await fetch("/api/admin/orders/create-shipment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      action: "ready_to_ship",
      ...(options.additional ? { additional: true } : {}),
    }),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as ReadyToShipResponse | null;
  if (!response.ok || !payload || payload.ok === false) {
    throw new DelhiveryApiError(
      payload?.error || "Unable to create the Ready to Ship shipment.",
      payload || { ok: false },
    );
  }
  return payload;
}

export async function updateDelhiveryManifest(
  orderId: string,
): Promise<ManifestUpdateResponse> {
  const id = String(orderId || "").trim();
  if (!id) throw new Error("Order id is required.");

  const response = await fetch("/api/admin/orders/create-shipment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action: "update_manifest" }),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | (ManifestUpdateResponse & { job?: ReadyToShipJob | null })
    | null;
  if (!response.ok || !payload || payload.ok === false) {
    throw new DelhiveryApiError(
      payload?.error || "Unable to update the Delhivery manifest.",
      payload || { ok: false },
    );
  }
  return payload;
}
