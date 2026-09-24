"use client";

import { useEffect, useState } from "react";

type Props = { id: string; onClose: () => void };

type ShipmentJob = {
  status?: "pending" | "processing" | "done" | "failed";
  attempts?: number;
  lastError?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Queued", className: "bg-amber-100 text-amber-800" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-800" },
  done: { label: "Created", className: "bg-green-100 text-green-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
};

function trackingFromOrder(order: any): { number: string; url: string } {
  const first = Array.isArray(order?.tracking) ? order.tracking[0] : null;
  return {
    number: String(first?.number || order?.awb || "").trim(),
    url: String(first?.url || "").trim(),
  };
}

function inr(value: unknown): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));
}

export default function AdminOrderDetailModal({ id, onClose }: Props) {
  const [order, setOrder] = useState<any | null>(null);
  const [shipment, setShipment] = useState<ShipmentJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tracking, setTracking] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || "Failed to load order.");
    const nextOrder = payload.order || null;
    const awb = trackingFromOrder(nextOrder);
    setOrder(nextOrder);
    setShipment((payload.shipment as ShipmentJob) || null);
    if (awb.number) {
      setTracking(awb.number);
      setTrackingUrl(awb.url);
    }
    return payload;
  }

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function saveTracking() {
    setNotice("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, trackingNumber: tracking, trackingUrl, carrier: "Delhivery" }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Update failed");
      await load();
      setNotice("Tracking saved and customer notified.");
    } catch (e) {
      setNotice(String((e as Error).message || e));
    } finally {
      setLoading(false);
    }
  }

  async function createShipment() {
    setNotice("");
    setCreating(true);
    setCopied(false);
    try {
      const res = await fetch("/api/admin/orders/create-shipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json();
      if (!res.ok) {
        const job = payload.job as ShipmentJob | undefined;
        if (job) setShipment(job);
        throw new Error(payload.error || "Create shipment failed");
      }
      const awb = String(payload.trackingNumber || payload.awb || "").trim();
      const url = String(payload.trackingUrl || "").trim();
      if (awb) {
        setTracking(awb);
        setTrackingUrl(url);
        setNotice(`Shipment created — AWB ${awb} attached to the order.`);
      } else {
        setNotice("Delhivery accepted the shipment (no AWB in the response payload).");
      }
      await load();
    } catch (e) {
      setNotice(String((e as Error).message || e));
    } finally {
      setCreating(false);
    }
  }

  async function copyAWB(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setNotice("Copy failed — select the AWB and copy manually.");
    }
  }

  if (!order && loading) return <div className="p-6">Loading…</div>;
  if (!order) return <div className="p-6">Order not found.</div>;

  const awb = trackingFromOrder(order);
  const statusMeta = shipment?.status ? STATUS_META[String(shipment.status)] : null;
  const trackHref = awb.url || (awb.number ? `https://www.delhivery.com/track/package/${awb.number}` : "");

  return (
<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-w-3xl w-full rounded-xl bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">Order #{order.orderNumber}</h3>
          <button type="button" className="text-sm text-gray-600" onClick={onClose}>Close</button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="font-semibold">Customer</h4>
            <p>{order.customer?.fullName || order.customerName}</p>
            <p className="text-sm text-gray-600">{order.customer?.email || order.emailLower}</p>
            <p className="text-sm text-gray-600">{order.customer?.phone}</p>
          </div>
          <div>
            <h4 className="font-semibold">Totals</h4>
            <p className="font-bold">{inr(order.total || 0)}</p>
            <p className="text-sm text-gray-600">Status: {order.fulfillmentStatus}</p>
          </div>
        </div>

        {/* Delhivery shipment panel */}
        <div className="mt-4 rounded-xl border border-[#d8e2d8] bg-[#f4f8f4] p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Delhivery shipment</h4>
            {statusMeta ? (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusMeta.className}`}>
                {statusMeta.label}
                {shipment?.attempts ? ` · attempt ${shipment.attempts}` : ""}
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">Not queued</span>
            )}
          </div>

          {awb.number ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">AWB</span>
              <span className="font-mono text-sm font-bold">{awb.number}</span>
              {trackHref && (
                <a href={trackHref} target="_blank" rel="noopener noreferrer" className="text-[#1f4a35] underline">
                  Track on Delhivery ↗
                </a>
              )}
              <button type="button" onClick={() => void copyAWB(awb.number)} className="text-xs text-gray-600 underline">
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-600">
              No AWB yet. One click below — Delhivery creates the order and the returned AWB auto-fills here.
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
                : awb.number
                  ? "Re-sync with Delhivery"
                  : "Create Delhivery Shipment"}
          </button>
        </div>
<div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Tracking number</label>
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
            <label className="mt-2 block text-sm font-medium">Tracking URL (optional)</label>
            <input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={saveTracking} className="rounded bg-green-600 px-3 py-2 text-white">Save & Notify</button>
            </div>
            {notice && <p className="mt-2 text-sm text-gray-700">{notice}</p>}
          </div>
          <div>
            <h4 className="font-semibold">Address</h4>
            <p>{order.customer?.address1 || order.customer?.address || ""}</p>
            <p className="text-sm text-gray-600">{[order.customer?.city, order.customer?.province, order.customer?.zip].filter(Boolean).join(", ")}</p>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="font-semibold">Items</h4>
          <ul className="mt-2 space-y-2">
            {(order.lineItems || []).map((li: any) => (
              <li key={li.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{li.title}</div>
                  <div className="text-sm text-gray-600">Qty: {li.quantity}</div>
                </div>
                <div className="font-medium">{inr(li.price?.amount || li.price || 0)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}