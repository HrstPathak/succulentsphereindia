"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildDelhiveryManualHandoff,
  calculateDelhiveryPackageMetrics,
  normalizeDelhiveryDetails,
  type DelhiveryBox,
  type DelhiveryCompanyDetails,
  type DelhiveryRateQuote,
  type DelhiveryServiceability,
  type DelhiveryShipmentDetails,
} from "@/lib/delhivery-shipment";

type ShipmentJob = {
  status?: string;
  mode?: "api" | "manual";
  attempts?: number;
  lastError?: string;
  requiresManualVerification?: boolean;
  trackingNumbers?: string[];
  updatedAt?: string;
};

type Workspace = {
  order: Record<string, any>;
  job: ShipmentJob | null;
  details: DelhiveryShipmentDetails;
  company: DelhiveryCompanyDetails;
  integration: {
    configured: boolean;
    clientNameConfigured: boolean;
    dashboardUrl: string;
  };
  serviceability?: DelhiveryServiceability | null;
  quotes?: DelhiveryRateQuote[];
};

type Props = {
  id: string;
  initialTracking?: Array<{ number?: string; url?: string; company?: string }>;
  shipment?: ShipmentJob | null;
  onUpdated?: () => void | Promise<void>;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  awaiting_details: { label: "Awaiting details", className: "bg-amber-100 text-amber-800" },
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  ready: { label: "Ready for API", className: "bg-blue-100 text-blue-800" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-800" },
  pending: { label: "Queued", className: "bg-amber-100 text-amber-800" },
  done: { label: "AWB created", className: "bg-green-100 text-green-800" },
  manual_ready: { label: "Manual ready", className: "bg-purple-100 text-purple-800" },
  failed: { label: "Needs attention", className: "bg-red-100 text-red-700" },
};

const inputClass = "mt-1 w-full rounded-lg border border-[#d8e2d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#52745f] focus:ring-2 focus:ring-[#52745f]/15";
const labelClass = "text-xs font-semibold text-[#526158]";

function money(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function orderAddress(order: Record<string, any>) {
  const customer = order?.customer || {};
  return [
    customer.address1 || customer.address,
    customer.address2,
    customer.landmark,
    customer.city,
    customer.state || customer.province,
    customer.pincode || customer.zip,
    customer.country || "India",
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
}

export default function AdminDelhiveryShipmentPanel({
  id,
  initialTracking = [],
  shipment: initialShipment = null,
  onUpdated,
}: Props) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [details, setDetails] = useState<DelhiveryShipmentDetails | null>(null);
  const [mode, setMode] = useState<"api" | "manual">("api");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [manualHandoff, setManualHandoff] = useState<Record<string, string | number | boolean> | null>(null);
  const [trackingNumber, setTrackingNumber] = useState(
    initialTracking.map((item) => String(item.number || "").trim()).filter(Boolean).join(", "),
  );
  const [trackingUrl, setTrackingUrl] = useState(initialTracking[0]?.url || "");
  const [copied, setCopied] = useState(false);

  async function load() {
    const response = await fetch(`/api/admin/orders/create-shipment?id=${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to load the shipment workspace.");
    const next = payload.workspace as Workspace;
    setWorkspace(next);
    setDetails(normalizeDelhiveryDetails(next.details));
    if (Array.isArray(next.order?.tracking) && next.order.tracking.length) {
      setTrackingNumber(
        next.order.tracking
          .map((item: any) => String(item.number || "").trim())
          .filter(Boolean)
          .join(", "),
      );
      setTrackingUrl(String(next.order.tracking[0]?.url || ""));
    }
    if (next.job?.status === "manual_ready") {
      setManualHandoff(
        buildDelhiveryManualHandoff({
          company: next.company,
          details: normalizeDelhiveryDetails(next.details),
          order: next.order,
        }),
      );
    }
    return next;
  }

  useEffect(() => {
    setBusy("load");
    load()
      .catch((loadError) => setError(String((loadError as Error).message || loadError)))
      .finally(() => setBusy(""));
  }, [id]);

  const metrics = useMemo(
    () => calculateDelhiveryPackageMetrics(details?.boxes || []),
    [details?.boxes],
  );


  function updateDetails(patch: Partial<DelhiveryShipmentDetails>) {
    setDetails((current) => normalizeDelhiveryDetails({ ...(current || {}), ...patch }));
    setNotice("");
    setError("");
  }

  function updateBox(index: number, patch: Partial<DelhiveryBox>) {
    setDetails((current) => {
      if (!current) return current;
      const boxes = current.boxes.map((box, boxIndex) =>
        boxIndex === index ? { ...box, ...patch } : box,
      );
      return normalizeDelhiveryDetails({ ...current, boxes });
    });
  }

  function setBoxCount(value: number) {
    const count = Math.max(1, Math.min(5, Math.round(value || 1)));
    setDetails((current) => {
      if (!current) return current;
      const boxes = Array.from({ length: count }, (_, index) =>
        current.boxes[index] || current.boxes[current.boxes.length - 1] || {
          lengthCm: 14,
          widthCm: 12,
          heightCm: 12,
          weightGrams: 450,
        },
      );
      return normalizeDelhiveryDetails({ ...current, boxes });
    });
  }

  async function runAction(action: "save" | "check" | "manual" | "create" | "retry") {
    if (!details) return;
    setBusy(action);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/admin/orders/create-shipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, details }),
      });
      const payload = await response.json();
      if (payload.workspace) {
        setWorkspace(payload.workspace as Workspace);
        setDetails(normalizeDelhiveryDetails(payload.workspace.details));
      }
      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.error || payload.result?.error || payload.result?.reason || "Shipment action failed.",
        );
      }
      if (action === "manual") {
        setManualHandoff(payload.manualHandoff || null);
        setMode("manual");
        setNotice("Manual handoff prepared. No AWB was created by the app.");
      } else if (action === "check") {
        setNotice("Delhivery serviceability and live rate quotes were refreshed.");
      } else if (action === "save") {
        setNotice("Shipment draft saved.");
      } else {
        const waybills = Array.isArray(payload.waybills) ? payload.waybills : [];
        if (waybills[0]) {
          setTrackingNumber(waybills[0]);
          setTrackingUrl(`https://www.delhivery.com/track/package/${encodeURIComponent(waybills[0])}`);
        }
        setNotice(`Delhivery created ${waybills.length || 1} AWB${waybills.length === 1 ? "" : "s"}.`);
      }
      await onUpdated?.();
    } catch (actionError) {
      setError(String((actionError as Error).message || actionError));
    } finally {
      setBusy("");
    }
  }

  async function saveTracking() {
    setBusy("tracking");
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          trackingNumbers: trackingNumber.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean),
          trackingUrl,
          carrier: "Delhivery",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save tracking.");
      setNotice("Tracking saved, shipment closed, and customer notified.");
      await load();
      await onUpdated?.();
    } catch (trackingError) {
      setError(String((trackingError as Error).message || trackingError));
    } finally {
      setBusy("");
    }
  }

  async function copyManualHandoff() {
    if (!manualHandoff || !workspace) return;
    const text = Object.entries(manualHandoff)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy failed. Select the manual details and copy them manually.");
    }
  }

  if (busy === "load" && !workspace) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">Loading Delhivery shipment workspace…</div>;
  }
  if (!workspace || !details) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error || "Shipment workspace unavailable."}</div>;
  }

  const { order, company, integration, job } = workspace;
  const customer = order.customer || {};
  const statusMeta = job?.status ? STATUS_META[job.status] : null;
  const tracking = Array.isArray(order.tracking) ? order.tracking : [];
  const quotes = Array.isArray(workspace.quotes) ? workspace.quotes : [];
  const apiWarnings = [
    !integration.configured ? "API credentials are incomplete." : "",
    !integration.clientNameConfigured ? "DELHIVERY_CLIENT_NAME is not set; seller name is being used as fallback." : "",
    !company.gstin ? "Seller GSTIN is missing." : "",
    !company.hsnCode ? "HSN code is missing." : "",
    !company.pickupLocation ? "Registered pickup location is missing." : "",
    details.invoiceTotal >= 50000 ? "This value requires an extended e-waybill payload; use manual mode." : "",
  ].filter(Boolean);

  return (
    <section className="space-y-4 rounded-2xl border border-[#d8e2d8] bg-[#f6f8f4] p-4 text-[#26352d] sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-white p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#708276]">Delhivery shipment desk</p>
          <h3 className="mt-1 text-xl font-bold">Order #{order.orderNumber || "—"} · {details.orderReference}</h3>
          <p className="mt-1 text-sm text-gray-600">Prepare, validate, quote, and create the shipment without exposing API credentials.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusMeta?.className || "bg-gray-100 text-gray-600"}`}>
          {statusMeta?.label || "Not prepared"}
          {job?.attempts ? ` · attempt ${job.attempts}` : ""}
        </span>
      </header>

      {tracking.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-green-800">Delhivery AWB</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tracking.map((item: any, index: number) => (
              <a key={`${item.number}-${index}`} href={item.url || `https://www.delhivery.com/track/package/${item.number}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-green-200 bg-white px-3 py-2 font-mono text-sm font-bold text-green-900">
                {item.number} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border bg-white p-4">
          <h4 className="font-bold">Company address</h4>
          <div className="mt-3 flex items-start gap-3">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="Succulent Sphere logo" className="h-14 w-14 rounded-xl object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#e8f0e8] font-serif text-xl text-[#345842]">SS</div>
            )}
            <div>
              <p className="font-semibold">{company.name}</p>
              <p className="text-sm text-gray-600">GSTIN: <strong>{company.gstin || "Not configured"}</strong></p>
              <p className="text-sm text-gray-600">PAN: {company.pan || "Not configured"}</p>
              <p className="mt-1 text-sm text-gray-700">{company.address || "Address not configured"}, {company.city}, {company.state} {company.pincode}</p>
              <p className="mt-2 rounded-lg bg-[#f1f5ef] px-3 py-2 text-xs text-gray-600">Pickup location: <strong>{company.pickupLocation || "Not configured"}</strong> · PIN {company.pickupPincode}</p>
            </div>
          </div>
        </article>

        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl border bg-white p-4">
            <h4 className="font-bold">Primary contact</h4>
            <p className="mt-3 font-semibold">{company.contactName || "Not configured"}</p>
            <p className="text-sm text-gray-600">Admin · {company.phone || "Phone not configured"}</p>
            <p className="break-all text-sm text-gray-600">{company.email || "Email not configured"}</p>
          </article>
          <article className="rounded-xl border bg-white p-4">
            <h4 className="font-bold">Business details</h4>
            <p className="mt-3 text-sm text-gray-600">Packages shipped per month</p>
            <p className="text-xl font-bold">{company.packagesPerMonth ?? "—"}</p>
          </article>
        </div>
      </div>


      <article className="rounded-xl border bg-white p-4">
        <h4 className="font-bold">Order details</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={labelClass}>Channel
            <input className={inputClass} value={details.channel} onChange={(event) => updateDetails({ channel: event.target.value })} />
          </label>
          <label className={labelClass}>Order ID / reference
            <input className={inputClass} value={details.orderReference} onChange={(event) => updateDetails({ orderReference: event.target.value })} />
          </label>
          <div>
            <p className={labelClass}>Seller detail</p>
            <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm font-semibold">{company.name}</p>
          </div>
          <div>
            <p className={labelClass}>Order date</p>
            <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">{new Date(details.orderDate).toLocaleString("en-IN")}</p>
          </div>
        </div>
      </article>

      <article className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold">Product & box details</h4>
            <p className="text-xs text-gray-500">Use the final packed dimensions and actual scale weight, not product dimensions.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className={labelClass}>Boxes
              <select className="ml-2 rounded-lg border bg-white px-3 py-2 text-sm" value={details.boxes.length} onChange={(event) => setBoxCount(Number(event.target.value))}>
                {[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
            <label className={labelClass}>Packaging
              <select className="ml-2 rounded-lg border bg-white px-3 py-2 text-sm" value={details.packageType} onChange={(event) => updateDetails({ packageType: event.target.value })}>
                <option>Cardboard Box</option>
                <option>Carton</option>
                <option>Plastic Pack</option>
                <option>Other</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="p-3">Product</th><th className="p-3">SKU / code</th><th className="p-3">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Total</th></tr>
            </thead>
            <tbody>
              {details.items.map((item, index) => (
                <tr key={`${item.sku}-${index}`} className="border-t">
                  <td className="p-3 font-medium">{item.title}</td>
                  <td className="p-3 font-mono text-xs text-gray-500">{item.sku || "—"}</td>
                  <td className="p-3">{item.quantity}</td>
                  <td className="p-3 text-right">{money(item.unitPrice)}</td>
                  <td className="p-3 text-right font-semibold">{money(item.unitPrice * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {details.boxes.map((box, index) => (
            <div key={index} className="rounded-xl border border-[#e2e9e2] bg-[#fbfcfa] p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold">Box {index + 1}</p>
                <p className="text-xs text-gray-500">{metrics.boxes[index]?.volumetricWeightGrams || 0} g volumetric</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([
                  ["lengthCm", "Length (cm)"],
                  ["widthCm", "Width (cm)"],
                  ["heightCm", "Height (cm)"],
                  ["weightGrams", "Actual weight (g)"],
                ] as const).map(([key, label]) => (
                  <label key={key} className={labelClass}>{label}
                    <input type="number" min={key === "weightGrams" ? 1 : 0.1} step={key === "weightGrams" ? 1 : 0.1} className={inputClass} value={box[key]} onChange={(event) => updateBox(index, { [key]: Number(event.target.value) })} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#eef4ed] px-3 py-2 text-sm">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={details.fragile} onChange={(event) => updateDetails({ fragile: event.target.checked })} className="h-4 w-4" />
            My package contains fragile items
          </label>
          <span>Chargeable weight: <strong>{metrics.chargeableWeightGrams} g</strong></span>
        </div>
      </article>


      <article className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="font-bold">Order summary</h4>
          {workspace.serviceability && (
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${workspace.serviceability.paymentServiceable ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
              {workspace.serviceability.paymentServiceable ? "Serviceable" : "Not serviceable"}
            </span>
          )}
        </div>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Pickup from</p><p className="mt-1 font-semibold">{company.pickupLocation || "Not configured"}, {company.city}, {company.pincode}</p></div>
          <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">Deliver to</p><p className="mt-1 font-semibold">{customer.fullName || order.customerName}<br /><span className="font-normal text-gray-600">{orderAddress(order)}</span></p></div>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3"><div><p className="text-xs text-gray-500">Box / item count</p><p className="font-bold">{details.boxes.length} / {details.items.reduce((sum, item) => sum + item.quantity, 0)}</p></div><div><p className="text-xs text-gray-500">Payment type</p><p className="font-bold">{details.paymentMode}</p></div></div>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3"><div><p className="text-xs text-gray-500">Actual / volumetric</p><p className="font-bold">{metrics.actualWeightGrams} / {metrics.volumetricWeightGrams} g</p></div><div><p className="text-xs text-gray-500">Chargeable weight</p><p className="font-bold">{metrics.chargeableWeightGrams} g</p></div></div>
        </div>
        {order.gathering?.deliveryVerificationStatus === "manual_review" && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Checkout serviceability was unavailable. Confirm this pincode in Delhivery before creating or manually dispatching the shipment.
          </p>
        )}
        {workspace.serviceability?.message && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{workspace.serviceability.message}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>Invoice total
            <input readOnly className={`${inputClass} bg-gray-50`} value={details.invoiceTotal} />
          </label>
          {details.paymentMode === "COD" && (
            <label className={labelClass}>Collectable amount
              <input readOnly className={`${inputClass} bg-gray-50`} value={details.collectableAmount} />
            </label>
          )}
          <label className={labelClass}>Shipping method
            <select className={inputClass} value={details.shippingMode} onChange={(event) => updateDetails({ shippingMode: event.target.value as "Surface" | "Express" })}>
              <option>Surface</option>
              <option>Express</option>
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-3`}>Packing / delivery notes
            <textarea className={`${inputClass} min-h-20`} value={details.notes} onChange={(event) => updateDetails({ notes: event.target.value })} placeholder="Optional packing instructions or customer note" />
          </label>
        </div>
        {quotes.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {quotes.map((quote) => (
              <button key={quote.mode} type="button" onClick={() => updateDetails({ shippingMode: quote.mode })} className={`rounded-xl border p-3 text-left ${details.shippingMode === quote.mode ? "border-[#345842] bg-[#eaf2e9]" : "bg-white"}`}>
                <span className="text-sm font-semibold">{quote.mode}</span>
                <span className="float-right font-bold">{money(quote.amount)}</span>
                <span className="block text-xs text-gray-500">Approximate · chargeable {quote.chargeableWeightGrams} g · zone {quote.zone || "—"}</span>
              </button>
            ))}
          </div>
        )}
      </article>

      <div className="flex rounded-xl border bg-white p-1">
        <button type="button" onClick={() => setMode("api")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${mode === "api" ? "bg-[#345842] text-white" : "text-gray-600"}`}>API automation</button>
        <button type="button" onClick={() => setMode("manual")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${mode === "manual" ? "bg-[#6d4d78] text-white" : "text-gray-600"}`}>Manual dashboard</button>
      </div>


      {mode === "api" ? (
        <article className="space-y-3 rounded-xl border bg-white p-4">
          <div>
            <h4 className="font-bold">Delhivery API automation</h4>
            <p className="mt-1 text-sm text-gray-600">The server rechecks serviceability immediately before creating the AWB. Rates remain approximate until Delhivery manifests the shipment.</p>
          </div>
          {apiWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-bold">Before API creation</p>
              <ul className="mt-1 list-disc pl-5">{apiWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          )}
          <label className="flex items-start gap-2 rounded-lg bg-[#eef4ed] p-3 text-sm font-semibold">
            <input type="checkbox" checked={details.confirmed} onChange={(event) => updateDetails({ confirmed: event.target.checked })} className="mt-0.5 h-4 w-4" />
            I verified the recipient, item count, payment mode, box count, dimensions, actual weight, and fragile flag.
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void runAction("save")} disabled={Boolean(busy)} className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-50">{busy === "save" ? "Saving…" : "Save draft"}</button>
            <button type="button" onClick={() => void runAction("check")} disabled={Boolean(busy)} className="rounded-lg bg-[#52745f] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy === "check" ? "Checking…" : "Check serviceability & rates"}</button>
            <button type="button" onClick={() => void runAction(job?.status === "failed" ? "retry" : "create")} disabled={Boolean(busy) || !details.confirmed || !integration.configured || details.invoiceTotal >= 50000 || Boolean(job?.requiresManualVerification)} className="rounded-lg bg-[#345842] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy === "create" || busy === "retry" ? "Creating…" : job?.requiresManualVerification ? "Verify allocation in dashboard" : job?.status === "failed" ? "Retry API shipment" : "Create via Delhivery API"}</button>
          </div>
          {job?.lastError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><strong>Last error:</strong> {job.lastError}{job.requiresManualVerification ? " Check Delhivery for a partial/uncertain AWB allocation before retrying." : ""}</p>}
        </article>
      ) : (
        <article className="space-y-3 rounded-xl border bg-white p-4">
          <div>
            <h4 className="font-bold">Manual Delhivery dashboard handoff</h4>
            <p className="mt-1 text-sm text-gray-600">Delhivery does not document a supported dashboard prefill URL. Copy the prepared values into the client panel, then attach the returned AWB below.</p>
          </div>
          <label className="flex items-start gap-2 rounded-lg bg-[#f4eef5] p-3 text-sm font-semibold">
            <input type="checkbox" checked={details.confirmed} onChange={(event) => updateDetails({ confirmed: event.target.checked })} className="mt-0.5 h-4 w-4" />
            I verified the packed measurements before preparing the dashboard handoff.
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void runAction("save")} disabled={Boolean(busy)} className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-50">Save draft</button>
            <button type="button" onClick={() => void runAction("manual")} disabled={Boolean(busy) || !details.confirmed} className="rounded-lg bg-[#6d4d78] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy === "manual" ? "Preparing…" : "Prepare manual handoff"}</button>
            {manualHandoff && <button type="button" onClick={() => void copyManualHandoff()} className="rounded-lg border px-4 py-2 text-sm font-bold">{copied ? "Copied ✓" : "Copy details"}</button>}
            {manualHandoff && <a href={integration.dashboardUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#6d4d78] px-4 py-2 text-sm font-bold text-white">Open Delhivery dashboard ↗</a>}
          </div>
          {manualHandoff && (
            <dl className="grid gap-2 rounded-lg border bg-gray-50 p-3 text-sm sm:grid-cols-2">
              {Object.entries(manualHandoff).map(([key, value]) => (
                <div key={key} className="rounded bg-white p-2"><dt className="text-[10px] font-bold uppercase text-gray-500">{key}</dt><dd className="mt-1 break-words">{String(value || "—")}</dd></div>
              ))}
            </dl>
          )}
        </article>
      )}


      <article className="rounded-xl border bg-white p-4">
        <h4 className="font-bold">Attach dashboard AWB</h4>
        <p className="mt-1 text-sm text-gray-600">Use this after creating the shipment manually. For multiple boxes, separate AWBs with commas. Saving closes the job and notifies the customer.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
          <label className={labelClass}>AWB(s) / tracking number(s)<input className={inputClass} value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} /></label>
          <label className={labelClass}>Tracking URL (optional)<input className={inputClass} value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} /></label>
          <button type="button" onClick={() => void saveTracking()} disabled={Boolean(busy) || !trackingNumber.trim()} className="self-end rounded-lg bg-[#345842] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy === "tracking" ? "Saving…" : "Save & Notify"}</button>
        </div>
      </article>

      {notice && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}

