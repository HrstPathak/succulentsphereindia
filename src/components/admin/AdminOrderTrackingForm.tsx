"use client";

import { useState } from "react";

export default function AdminOrderTrackingForm({
  id,
  initialTracking = [],
}: {
  id: string;
  initialTracking?: Array<{ number?: string; url?: string; company?: string }>;
}) {
  const [trackingNumber, setTrackingNumber] = useState(initialTracking?.[0]?.number || "");
  const [trackingUrl, setTrackingUrl] = useState(initialTracking?.[0]?.url || "");
  const [carrier, setCarrier] = useState(initialTracking?.[0]?.company || "Delhivery");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

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
      setNotice("Tracking saved.");
    } catch (e) {
      setNotice(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <label className="block text-sm font-medium">Tracking number</label>
      <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
      <label className="block text-sm font-medium mt-2">Tracking URL (optional)</label>
      <input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
      <label className="block text-sm font-medium mt-2">Carrier</label>
      <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
      <div className="flex gap-2 mt-3">
        <button onClick={save} disabled={busy} className="rounded bg-green-600 text-white px-3 py-2">
          {busy ? "Saving…" : "Save & Notify"}
        </button>
      </div>
      {notice && <p className="mt-2 text-sm text-gray-700">{notice}</p>}
    </div>
  );
}
