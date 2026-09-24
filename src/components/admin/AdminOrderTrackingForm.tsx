"use client";

import { useState } from "react";

type ShipmentJob = {
  status?: "pending" | "processing" | "done" | "failed";
  attempts?: number;
  lastError?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  updatedAt?: string;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Queued", className: "bg-amber-100 text-amber-800" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-800" },
  done: { label: "Created", className: "bg-green-100 text-green-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
};

export default function AdminOrderTrackingForm({
  id,
  initialTracking = [],
  shipment: propShipment = null,
}: {
  id: string;
  initialTracking?: Array<{ number?: string; url?: string; company?: string }>;
  shipment?: ShipmentJob | null;
}) {
  const [trackingNumber, setTrackingNumber] = useState(initialTracking?.[0]?.number || "");
  const [trackingUrl, setTrackingUrl] = useState(initialTracking?.[0]?.url || "");
  const [carrier, setCarrier] = useState(initialTracking?.[0]?.company || "Delhivery");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [localShipment, setLocalShipment] = useState<ShipmentJob | null>(null);
  const shipment = localShipment ?? propShipment;

  async function save() {
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, trackingNumber, trackingUrl, carrier }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Update failed");
      setNotice("Tracking saved and customer notified.");
    } catch (e) {
      setNotice(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  }

  async function createShipment() {
    setNotice("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/orders/create-shipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json();
      if (!res.ok) {
        if (payload.job) setLocalShipment(payload.job as ShipmentJob);
        throw new Error(payload.error || "Create shipment failed");
      }
      const awb = String(payload.trackingNumber || payload.awb || "").trim();
      const url = String(payload.trackingUrl || "").trim();
      if (awb) {
        setTrackingNumber(awb);
        setTrackingUrl(url);
        setNotice(`Shipment created — AWB ${awb} attached.`);
      } else {
        setNotice("Delhivery accepted the shipment. No AWB returned in the response.");
      }
    } catch (e) {
      setNotice(String((e as Error).message || e));
    } finally {
      setCreating(false);
    }
  }

  const statusMeta = shipment?.status ? STATUS_META[String(shipment.status)] : null;
  const awbNumber = trackingNumber || shipment?.trackingNumber || "";
  const awbLink = trackingUrl || (awbNumber ? `https://www.delhivery.com/track/package/${awbNumber}` : "");

  return (
<div className="mt-3">
      <div className="rounded-lg border border-[#d9e2d9] bg-[#f3f7f3] p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Delhivery shipment</span>
          {statusMeta ? (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusMeta.className}`}>
              {statusMeta.label}
              {shipment?.attempts ? ` · attempt ${shipment.attempts}` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">Not queued</span>
          )}
        </div>
        {awbNumber ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-white px-3 py-2 font-mono text-sm">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">AWB</span>
            <span className="font-bold">{awbNumber}</span>
            {awbLink && (
              <a href={awbLink} target="_blank" rel="noopener noreferrer" className="text-[#1f4a35] underline">
                Track on Delhivery ↗
              </a>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-600">
            No AWB yet. One click below — Delhivery creates the order and the AWB auto-fills here.
          </p>
        )}
        {shipment?.status === "failed" && shipment.lastError ? (
          <p className="mt-1 text-xs text-red-700">Last error: {shipment.lastError}</p>
        ) : null}
        <button
          type="button"
          onClick={createShipment}
          disabled={creating}
          className="mt-2 w-full rounded bg-amber-500 px-3 py-2 text-white disabled:opacity-60"
        >
          {creating
            ? "Creating on Delhivery…"
            : shipment?.status === "failed"
              ? "Retry Delhivery Shipment"
              : "Create Delhivery Shipment"}
        </button>
      </div>

      <label className="mt-3 block text-sm font-medium">Tracking number</label>
      <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
      <label className="mt-2 block text-sm font-medium">Tracking URL (optional)</label>
      <input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
      <label className="mt-2 block text-sm font-medium">Carrier</label>
      <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={save} disabled={busy} className="rounded bg-green-600 px-3 py-2 text-white">
          {busy ? "Saving…" : "Save & Notify"}
        </button>
      </div>
      {notice && <p className="mt-2 text-sm text-gray-700">{notice}</p>}
    </div>
  );
}