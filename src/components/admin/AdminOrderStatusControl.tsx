'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  Truck,
  XCircle,
} from "lucide-react";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

type Status = "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

const STATUS_META: Record<
  Status,
  { label: string; tone: string; chip: string; icon: typeof Truck }
> = {
  IN_TRANSIT: {
    label: "In transit",
    tone: "border-[#cfe0d1] bg-[#eef5ef] text-[#1f4a35] hover:bg-[#e2eee4]",
    chip: "bg-[#eef5ef] text-[#1f4a35]",
    icon: Truck,
  },
  OUT_FOR_DELIVERY: {
    label: "Out for delivery",
    tone: "border-[#d6dcf0] bg-[#eef1fb] text-[#2c3c78] hover:bg-[#e3e8f8]",
    chip: "bg-[#eef1fb] text-[#2c3c78]",
    icon: MapPin,
  },
  DELIVERED: {
    label: "Mark delivered",
    tone: "border-[#bfe0cb] bg-[#e9f7ee] text-[#1c6b3f] hover:bg-[#ddf2e5]",
    chip: "bg-[#e9f7ee] text-[#1c6b3f]",
    icon: PackageCheck,
  },
  CANCELLED: {
    label: "Cancel order",
    tone: "border-[#f0c9c9] bg-[#fdf0f0] text-[#a3402f] hover:bg-[#fbe3e3]",
    chip: "bg-[#fdf0f0] text-[#a3402f]",
    icon: XCircle,
  },
};

/** Statuses that need an explicit yes/no before applying. */
const CONFIRMED: Status[] = ["DELIVERED", "CANCELLED"];
const ALL: Status[] = ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

function normalise(value: string | undefined): Status | "" {
  const upper = String(value || "").toUpperCase();
  return (ALL.includes(upper as Status) ? (upper as Status) : "") as Status | "";
}

/**
 * Manual order status control. Lets an admin move an order to in transit, out
 * for delivery, delivered or cancelled without waiting for a carrier scan.
 * Every change writes the Firestore order and emails the customer; the AWB and
 * the Delhivery manifest are not modified.
 */
export default function AdminOrderStatusControl({
  orderId,
  orderNumber,
  customerName,
  currentStatus,
  codBalance,
  trackingNumber,
}: {
  orderId: string;
  orderNumber: number;
  customerName: string;
  currentStatus?: string;
  codBalance?: number;
  trackingNumber?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const active = normalise(currentStatus);
  const ask = pending ? STATUS_META[pending] : null;

  async function apply(status: Status) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status, sendEmail: true }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Unable to update the order status.");
      }
      setPending(null);
      setNotice(
        payload?.email?.sent
          ? `${STATUS_META[status].label} — customer emailed.`
          : payload?.email?.skipped
            ? `${STATUS_META[status].label} — email provider not configured.`
            : `${STATUS_META[status].label} saved, but the email could not be sent.`,
      );
      router.refresh();
    } catch (updateError) {
      setError(String((updateError as Error).message || updateError));
    } finally {
      setBusy(false);
    }
  }


  return (
    <article className="rounded-xl border bg-white p-4 shadow">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Order status</h2>
        {active ? (
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_META[active].chip}`}
          >
            {STATUS_META[active].label}
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Not set
          </span>
        )}
      </div>

      <p className="mb-3 text-xs text-gray-600">
        Set the status by hand when the courier update is missing or the order was
        handled outside Delhivery. This only updates your record and emails the
        customer — the AWB in Delhivery is unchanged.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {ALL.map((status) => {
          const meta = STATUS_META[status];
          const Icon = meta.icon;
          const isActive = active === status;
          return (
            <button
              key={status}
              type="button"
              disabled={busy || isActive}
              onClick={() =>
                CONFIRMED.includes(status) ? setPending(status) : void apply(status)
              }
              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${meta.tone}`}
            >
              {busy && pending === status ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Icon className="size-4" aria-hidden="true" />
              )}
              {isActive ? `${meta.label} (current)` : meta.label}
            </button>
          );
        })}
      </div>

      {notice ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <AdminConfirmModal
        open={Boolean(ask)}
        title={pending === "CANCELLED" ? "Cancel this order?" : "Mark as delivered?"}
        eyebrow={`Order #${orderNumber}`}
        tone={pending === "CANCELLED" ? "danger" : "success"}
        message={
          ask && pending
            ? pending === "CANCELLED"
              ? `${customerName}'s order will be marked cancelled and a cancellation email will be sent. The Delhivery AWB is not cancelled — do that in the Delhivery dashboard too.`
              : `${customerName}'s order will be marked delivered and a delivery email will be sent. Make sure the parcel really reached the customer.`
            : ""
        }
        confirmLabel={busy ? "Working…" : ask?.label || "Yes"}
        cancelLabel="No, go back"
        busy={busy}
        onConfirm={() => pending && void apply(pending)}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
      >
        {pending === "DELIVERED" && (codBalance || 0) > 0 ? (
          <p className="rounded-2xl bg-[#fdf6ec] px-4 py-2.5 text-xs text-[#7a5a1e]">
            Collect ₹{Number(codBalance).toFixed(2)} before marking delivered.
          </p>
        ) : null}
        {trackingNumber ? (
          <p className="mt-3 rounded-2xl bg-[#f4f7f4] px-4 py-2.5 text-xs text-[#5a6b5d]">
            AWB{" "}
            <span className="font-mono font-bold text-[#102419]">{trackingNumber}</span>{" "}
            stays the same.
          </p>
        ) : null}
      </AdminConfirmModal>
    </article>
  );
}
