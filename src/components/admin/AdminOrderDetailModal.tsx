"use client";

import { useEffect, useState } from "react";
import AdminOrderTrackingForm from "./AdminOrderTrackingForm";
import { getOrderGrandTotal } from "@/lib/orderAmounts";

type Props = { id: string; onClose: () => void };

type ShipmentJob = {
  status?: string;
  attempts?: number;
  lastError?: string;
};

function inr(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value || 0));
}

export default function AdminOrderDetailModal({ id, onClose }: Props) {
  const [order, setOrder] = useState<any | null>(null);
  const [shipment, setShipment] = useState<ShipmentJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load order.");
    setOrder(payload.order || null);
    setShipment((payload.shipment as ShipmentJob) || null);
  }

  useEffect(() => {
    setLoading(true);
    load()
      .catch((loadError) => setError(String((loadError as Error).message || loadError)))
      .finally(() => setLoading(false));
  }, [id]);

  const tracking = Array.isArray(order?.tracking) ? order.tracking : [];
  const orderTotal = getOrderGrandTotal(order);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#102419]/55 p-3 backdrop-blur-sm sm:p-6">
      <button type="button" aria-label="Close order details" className="fixed inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 mx-auto my-4 w-full max-w-6xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#708276]">Order shipment details</p>
            <h2 className="mt-1 text-2xl font-bold">Order #{order?.orderNumber || "…"}</h2>
            {order && <p className="mt-1 text-sm text-gray-600">{order.customer?.fullName || order.customerName} · {inr(orderTotal)} · {order.fulfillmentStatus}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border px-3 py-2 text-sm font-bold">Close</button>
        </header>
        {loading && <p className="py-8 text-center text-sm text-gray-500">Loading order…</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {order && !loading && (
          <AdminOrderTrackingForm
            id={id}
            initialTracking={tracking}
            shipment={shipment}
            onUpdated={async () => {
              await load();
            }}
          />
        )}
      </div>
    </div>
  );
}
