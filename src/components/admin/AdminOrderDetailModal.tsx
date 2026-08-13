"use client";

import { useEffect, useState } from "react";

type Props = { id: string; onClose: () => void };

export default function AdminOrderDetailModal({ id, onClose }: Props) {
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/admin/orders/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!mounted) return;
        setOrder(payload.order || null);
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
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
      setNotice("Tracking saved and email sent.");
      // reload order
      const orderRes = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
      const orderPayload = await orderRes.json();
      setOrder(orderPayload.order || null);
    } catch (e) {
      setNotice(String((e as Error).message || e));
    } finally { setLoading(false); }
  }

  async function createShipment() {
    setNotice("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders/create-shipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Create shipment failed");
      setTracking(payload.trackingNumber || "");
      setTrackingUrl(payload.trackingUrl || "");
      setNotice("Shipment created and tracking attached.");
      const orderRes = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
      const orderPayload = await orderRes.json();
      setOrder(orderPayload.order || null);
    } catch (e) {
      setNotice(String((e as Error).message || e));
    } finally { setLoading(false); }
  }

  if (!order && loading) return (<div className="p-6">Loading…</div>);
  if (!order) return (<div className="p-6">Order not found.</div>);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 max-w-3xl w-full rounded-xl bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">Order #{order.orderNumber}</h3>
          <button className="text-sm text-gray-600" onClick={onClose}>Close</button>
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
            <p className="font-bold">{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(order.total || 0))}</p>
            <p className="text-sm text-gray-600">Status: {order.fulfillmentStatus}</p>
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
                <div className="font-medium">{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(li.price?.amount||li.price||0))}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Tracking number</label>
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
            <label className="block text-sm font-medium mt-2">Tracking URL (optional)</label>
            <input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
            <div className="flex gap-2 mt-3">
              <button onClick={saveTracking} className="rounded bg-green-600 text-white px-3 py-2">Save & Notify</button>
              <button onClick={createShipment} className="rounded bg-amber-500 text-white px-3 py-2">Create Delhivery Shipment</button>
            </div>
            {notice && <p className="mt-2 text-sm text-gray-700">{notice}</p>}
          </div>
          <div>
            <h4 className="font-semibold">Address</h4>
            <p>{order.customer?.address1 || order.customer?.address || ''}</p>
            <p className="text-sm text-gray-600">{[order.customer?.city, order.customer?.province, order.customer?.zip].filter(Boolean).join(', ')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
