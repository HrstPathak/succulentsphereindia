"use client";

import { useState } from "react";
import {
  createReadyToShipOrder,
  DelhiveryApiError,
  updateDelhiveryManifest,
} from "@/lib/delhiveryApi";
import {
  buildDelhiveryOrderReference,
  buildDelhiveryTrackingUrl,
  nextDelhiverySequence,
} from "@/lib/delhiveryTracking";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

type ShipmentJob = {
  status?: string;
  attempts?: number;
  lastError?: string;
  trackingNumber?: string;
  trackingNumbers?: string[];
  trackingUrl?: string;
  manifestUpdatedAt?: string;
  orderReferences?: string[];
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Queued", className: "bg-amber-100 text-amber-800" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-800" },
  ready: { label: "Ready", className: "bg-blue-100 text-blue-800" },
  done: { label: "Ready to Ship", className: "bg-green-100 text-green-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
};

const isValidAwb = (value: unknown) => /^[A-Za-z0-9]{10,}$/.test(String(value || "").trim());

export default function AdminDelhiveryShipmentPanel({
  id,
  initialTracking = [],
  shipment: propShipment = null,
  customerName = "Customer",
  customerPhone = "",
  orderNumber = "",
  onUpdated,
}: {
  id: string;
  initialTracking?: Array<{ number?: string; url?: string; company?: string }>;
  shipment?: ShipmentJob | null;
  customerName?: string;
  customerPhone?: string;
  orderNumber?: string | number;
  onUpdated?: () => void | Promise<void>;
}) {
  const validTracking = initialTracking.find((item) => isValidAwb(item.number));
  const [trackingNumber, setTrackingNumber] = useState(validTracking?.number || "");
  const [trackingUrl, setTrackingUrl] = useState(validTracking?.url || "");
  const [carrier, setCarrier] = useState(validTracking?.company || "Delhivery");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingManifest, setUpdatingManifest] = useState(false);
  const [notice, setNotice] = useState("");
  const [localShipment, setLocalShipment] = useState<ShipmentJob | null>(null);
  const [confirmCreateAnother, setConfirmCreateAnother] = useState(false);
  const [confirmManifest, setConfirmManifest] = useState(false);
  const shipment = localShipment ?? propShipment;

  async function save() {
    setNotice("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, trackingNumber, trackingUrl, carrier }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Update failed");
      setNotice("Tracking saved and customer notified.");
      await onUpdated?.();
    } catch (error) {
      setNotice(String((error as Error).message || error));
    } finally {
      setBusy(false);
    }
  }

  function requestCreateShipment() {
    setNotice("");
    // A confirmed AWB means this store order already produced a parcel.
    // Ask before creating another one instead of silently blocking.
    if (awbNumber) {
      setConfirmCreateAnother(true);
      return;
    }
    void createShipment(false);
  }

  async function createShipment(additional: boolean) {
    setNotice("");
    setCreating(true);
    try {
      const payload = await createReadyToShipOrder(id, { additional });
      if (payload.job) setLocalShipment(payload.job as ShipmentJob);
      const awb = String(payload.trackingNumber || payload.waybills?.[0] || "").trim();
      const url = String(payload.trackingUrl || "").trim();
      setConfirmCreateAnother(false);
      if (awb) {
        setTrackingNumber(awb);
        setTrackingUrl(url);
        if (payload.additional) {
          setNotice(
            `Another Delhivery shipment was created as order ${
              payload.orderReference || "one more"
            }. New AWB: ${awb}.`,
          );
        } else if (payload.skipped) {
          setNotice(`Shipment already created - AWB ${awb} is attached.`);
        } else {
          setNotice(
            `AWB generated successfully: ${awb}. The shipment was created in Delhivery and saved to Firestore.`,
          );
        }
      } else {
        setNotice("Delhivery accepted the shipment. No AWB returned in the response.");
      }
      await onUpdated?.();
    } catch (error) {
      if (error instanceof DelhiveryApiError && error.payload.job) {
        setLocalShipment(error.payload.job as ShipmentJob);
      }
      setNotice(String((error as Error).message || error));
    } finally {
      setCreating(false);
    }
  }

  async function updateManifest() {
    setNotice("");
    if (!awbNumber) {
      setNotice("Create the Delhivery shipment before updating its manifest.");
      return;
    }
    setConfirmManifest(true);
  }

  async function confirmUpdateManifest() {
    setUpdatingManifest(true);
    try {
      const payload = await updateDelhiveryManifest(id);
      if (payload.job) setLocalShipment(payload.job as ShipmentJob);
      setConfirmManifest(false);
      setNotice(
        `Delhivery manifest updated successfully for AWB ${payload.waybill}.`,
      );
      await onUpdated?.();
    } catch (error) {
      if (error instanceof DelhiveryApiError && error.payload.job) {
        setLocalShipment(error.payload.job as ShipmentJob);
      }
      setNotice(String((error as Error).message || error));
    } finally {
      setUpdatingManifest(false);
    }
  }

  const awbNumber = [trackingNumber, shipment?.trackingNumber, ...(shipment?.trackingNumbers || [])].find(isValidAwb) || "";
  const awbLink = buildDelhiveryTrackingUrl(awbNumber);
  const statusMeta = awbNumber
    ? STATUS_META.done
    : shipment?.status
      ? STATUS_META[String(shipment.status)]
      : null;

  function sendTrackingWhatsApp() {
    const phone = String(customerPhone || "").replace(/\D/g, "");
    if (!phone || !awbNumber) {
      setNotice("A valid customer phone number and AWB are required for WhatsApp tracking.");
      return;
    }
    const phoneWithCountryCode = phone.length === 10 ? `91${phone}` : phone;
    const message = [
      `Hello ${customerName || "there"},`,
      "",
      `Your Succulent Sphere order #${orderNumber || ""} has been shipped via Delhivery.`,
      `AWB: ${awbNumber}`,
      `Track your shipment: ${awbLink}`,
      "",
      "Thank you for shopping with Succulent Sphere!",
    ].join("\n");
    window.open(`https://api.whatsapp.com/send?phone=${phoneWithCountryCode}&text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <div className="mt-3">
      <div className="rounded-lg border border-[#d9e2d9] bg-[#f3f7f3] p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Delhivery shipment</span>
          {statusMeta ? (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusMeta.className}`}>
              {statusMeta.label}{shipment?.attempts && !awbNumber ? ` · attempt ${shipment.attempts}` : awbNumber && shipment?.attempts ? ` · ${shipment.attempts} prior attempts` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">Not queued</span>
          )}
        </div>
        {awbNumber ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-white px-3 py-2 font-mono text-sm">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">AWB</span>
            <span className="font-bold">{awbNumber}</span>
            {awbLink && <a href={awbLink} target="_blank" rel="noopener noreferrer" className="text-[#1f4a35] underline">Track on Delhivery ↗</a>}
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-600">No AWB yet. One click below - Delhivery creates the order and the AWB auto-fills here.</p>
        )}
        {shipment?.status === "failed" && !awbNumber && shipment.lastError && <p className="mt-1 text-xs text-red-700">Last error: {shipment.lastError}</p>}
        <button type="button" onClick={requestCreateShipment} disabled={creating} className="mt-3 w-full rounded bg-amber-500 px-3 py-2 font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60">
          {creating
            ? "Creating on Delhivery..."
            : awbNumber
              ? "Create one more Delhivery shipment"
              : shipment?.status === "failed"
                ? "Retry Ready to Ship"
                : "Create Ready to Ship"}
        </button>
        {awbNumber ? (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-900">
              If the manifest was created with missing package/payment data, update the existing AWB. This does not create another shipment.
            </p>
            <button
              type="button"
              onClick={() => void updateManifest()}
              disabled={updatingManifest}
              className="mt-2 w-full rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {updatingManifest ? "Updating Delhivery manifest..." : "Update Delhivery Manifest"}
            </button>
            {shipment?.manifestUpdatedAt ? (
              <p className="mt-1 text-[11px] text-amber-800">
                Last local update: {new Date(shipment.manifestUpdatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <label className="mt-3 block text-sm font-medium">Tracking number</label>
      <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
      <label className="mt-2 block text-sm font-medium">Tracking URL (optional)</label>
      <input value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
      <label className="mt-2 block text-sm font-medium">Carrier</label>
      <input value={carrier} onChange={(event) => setCarrier(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => void save()} disabled={busy} className="rounded bg-green-600 px-3 py-2 text-white">
          {busy ? "Saving..." : "Save & Notify"}
        </button>
        <button type="button" onClick={sendTrackingWhatsApp} disabled={!awbNumber} className="rounded bg-emerald-600 px-3 py-2 text-white disabled:opacity-50">
          Send Tracking via WhatsApp
        </button>
      </div>
      {notice && <p className="mt-2 text-sm text-gray-700">{notice}</p>}

      <AdminConfirmModal
        open={confirmCreateAnother}
        eyebrow="Already created"
        title="Order was already created in Delhivery"
        tone="warning"
        busy={creating}
        confirmLabel="Yes, create one more"
        cancelLabel="No, keep as it is"
        onCancel={() => setConfirmCreateAnother(false)}
        onConfirm={() => void createShipment(true)}
        message={
          <>
            <p>
              This order already has{" "}
              <strong className="font-mono text-[#102419]">{awbNumber}</strong> with
              Delhivery. Do you want to make <strong>1 more</strong> shipment for the same
              order?
            </p>
            <p className="mt-3">
              The new parcel is created with its own AWB and a distinct reference so
              Delhivery does not reject it as a duplicate.
            </p>
          </>
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-[#e6ece6] bg-white p-4 text-sm">
          <dt className="font-semibold text-[#6e826f]">Existing AWB</dt>
          <dd className="font-mono">{awbNumber}</dd>
          <dt className="font-semibold text-[#6e826f]">Next reference</dt>
          <dd className="font-mono">
            {buildDelhiveryOrderReference(
              orderNumber || id,
              nextDelhiverySequence(orderNumber || id, shipment?.orderReferences || []),
            )}
          </dd>
          <dt className="font-semibold text-[#6e826f]">AWBs after this</dt>
          <dd className="font-mono">
            {(shipment?.trackingNumbers || []).length + 1}
          </dd>
        </dl>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={confirmManifest}
        eyebrow="Update AWB"
        title="Update the live Delhivery manifest?"
        tone="info"
        busy={updatingManifest}
        confirmLabel="Yes, update manifest"
        cancelLabel="No, cancel"
        onCancel={() => setConfirmManifest(false)}
        onConfirm={() => void confirmUpdateManifest()}
        message={
          <>
            <p>
              This sends the confirmed <strong>14 × 12 × 12 cm</strong> dimensions,{" "}
              <strong>450 gm</strong> weight, payment mode, remaining COD amount, and
              Succulents product details to AWB{" "}
              <strong className="font-mono text-[#102419]">{awbNumber}</strong>.
            </p>
            <p className="mt-3">
              This edits the existing AWB — it does not create another shipment. Delhivery
              only permits this before dispatch/pickup.
            </p>
          </>
        }
      />
    </div>
  );
}
