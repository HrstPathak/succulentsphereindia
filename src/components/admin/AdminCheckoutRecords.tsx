"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type CheckoutRecord = {
  id: string;
  razorpayOrderId: string;
  customer: Record<string, any>;
  items: Array<Record<string, any>>;
  gathering: Record<string, any>;
  paymentMode: string;
  paymentModeLabel: string;
  paymentStatus: string;
  checkoutStatus: string;
  paymentId: string;
  gatewayPaymentMethod: string;
  paymentFailureReason: string;
  paymentAttempts: Array<Record<string, any>>;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  codFee: number;
  totalWithCod: number;
  walletAmountApplied: number;
  payableAmount: number;
  orderCreated: boolean;
  firebaseOrderId: string;
  orderNumber: number;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

const inr = (amount: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
}).format(Number(amount) || 0);

const dateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

function Status({ value }: { value: string }) {
  const status = value.replaceAll("_", " ") || "pending";
  const tone = value === "captured" || value === "order_created"
    ? "bg-emerald-100 text-emerald-800"
    : value === "failed" || value === "payment_failed"
      ? "bg-rose-100 text-rose-800"
      : "bg-amber-100 text-amber-900";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${tone}`}>{status}</span>;
}

function ProductThumbnail({ src, alt }: { src: unknown; alt: string }) {
  const [failed, setFailed] = useState(false);
  const value = typeof src === "string" ? src.trim() : "";
  const safeSrc = value.startsWith("https://") || value.startsWith("http://") || (value.startsWith("/") && !value.startsWith("//"))
    ? value
    : "";

  if (!safeSrc || failed) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[#dce4dc] bg-[#f1f5ef] px-1 text-center text-[10px] font-medium text-[#78887d]">
        Image unavailable
      </div>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-16 w-16 shrink-0 rounded-xl border border-[#dce4dc] bg-[#f1f5ef] object-cover"
    />
  );
}

export default function AdminCheckoutRecords() {
  const [records, setRecords] = useState<CheckoutRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (cursor?: string, append = false) => {
    if (append) setLoadingMore(true);
    else setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/admin/checkouts?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load checkout records.");
      setRecords((current) => append ? [...current, ...(payload.records || [])] : (payload.records || []));
      setNextCursor(payload.nextCursor || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load checkout records.");
    } finally {
      setBusy(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) => [
      record.customer.fullName,
      record.customer.email,
      record.customer.phone,
      record.razorpayOrderId,
      record.paymentId,
      record.paymentStatus,
      record.checkoutStatus,
      record.orderNumber,
    ].join(" ").toLowerCase().includes(needle));
  }, [query, records]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-auto text-sm text-[#64766a]">Separate checkout audit records, including abandoned and failed payment attempts.</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search customer, payment, or order..."
          className="min-w-[220px] flex-1 rounded-xl border border-[#d7e0d9] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6f9878] sm:max-w-sm"
        />
        <button onClick={() => void load()} disabled={busy} className="rounded-xl border border-[#d5dfd5] bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">
          Refresh
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      <div className="overflow-hidden rounded-2xl border border-[#dce4dc] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[#f1f5ef] text-xs uppercase tracking-wide text-[#64766a]">
              <tr><th className="px-4 py-3">Started</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Payment choice</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Order</th><th className="px-4 py-3">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-[#edf1ed]">
              {busy && records.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[#64766a]">Loading checkout records...</td></tr>}
              {!busy && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[#64766a]">No checkout records found.</td></tr>}
              {filtered.map((record) => (
                <Fragment key={record.id}>
                  <tr className="align-top">
                    <td className="whitespace-nowrap px-4 py-3">{dateTime(record.createdAt)}</td>
                    <td className="px-4 py-3"><div className="font-semibold">{record.customer.fullName || "Guest"}</div><div className="text-xs text-[#64766a]">{record.customer.email || "-"}</div></td>
                    <td className="px-4 py-3">{record.paymentModeLabel || record.paymentMode || "-"}</td>
                    <td className="px-4 py-3"><Status value={record.paymentStatus} /><div className="mt-1 text-xs text-[#64766a]">{record.checkoutStatus.replaceAll("_", " ")}</div></td>
                    <td className="whitespace-nowrap px-4 py-3"><div className="font-semibold">{inr(record.payableAmount)}</div><div className="text-xs text-[#64766a]">Total {inr(record.totalWithCod)}</div></td>
                    <td className="px-4 py-3">{record.orderCreated ? <span className="font-semibold text-emerald-800">#{record.orderNumber || "created"}</span> : <span className="text-[#64766a]">Not created</span>}</td>
                    <td className="px-4 py-3"><button aria-expanded={expanded === record.id} className="font-semibold text-[#31533e] underline" onClick={() => setExpanded((current) => current === record.id ? null : record.id)}>{expanded === record.id ? "Hide" : "View"}</button></td>
                  </tr>
                  {expanded === record.id && (
                    <tr>
                      <td colSpan={7} className="bg-[#f7f9f6] px-4 py-5 sm:px-6">
                        <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.5fr)]">
                          <div className="space-y-3 rounded-2xl border border-[#e1e8e0] bg-white p-4 text-sm">
                            <h3 className="font-bold">Checkout and delivery</h3>
                            <p><span className="font-semibold">Razorpay order:</span> <span className="break-all">{record.razorpayOrderId}</span></p>
                            {record.paymentId && <p><span className="font-semibold">Payment ID:</span> <span className="break-all">{record.paymentId}</span></p>}
                            {record.gatewayPaymentMethod && <p><span className="font-semibold">Gateway method:</span> {record.gatewayPaymentMethod}</p>}
                            <p><span className="font-semibold">Phone:</span> {record.customer.phone || "-"}</p>
                            <p><span className="font-semibold">Address:</span> {[record.customer.address, record.customer.city, record.customer.state, record.customer.pincode].filter(Boolean).join(", ") || "-"}</p>
                            <p><span className="font-semibold">Delivery slot:</span> {record.gathering.deliverySlot || "-"}</p>
                            <p><span className="font-semibold">Gift wrap:</span> {record.gathering.giftWrap ? "Yes" : "No"}</p>
                            {record.gathering.notes && <p><span className="font-semibold">Notes:</span> {record.gathering.notes}</p>}
                            {record.paymentFailureReason && <p className="text-rose-700"><span className="font-semibold">Failure:</span> {record.paymentFailureReason}</p>}
                            {record.lastError && <p className="text-amber-800"><span className="font-semibold">Processing note:</span> {record.lastError}</p>}
                          </div>

                          <div className="space-y-3 rounded-2xl border border-[#e1e8e0] bg-white p-4 text-sm">
                            <h3 className="font-bold">Products and totals</h3>
                            <ul className="space-y-3">
                              {record.items.map((item, index) => (
                                <li key={`${record.id}-${item.id || index}`} className="flex min-w-0 items-center gap-3 border-b border-[#edf1ed] pb-3 last:border-0 last:pb-0">
                                  <ProductThumbnail src={item.image || item.imageUrl || item.image_url} alt={String(item.imageAlt || item.title || "Plant product")} />
                                  <span className="min-w-0 flex-1">
                                    <span className="block font-semibold text-[#23392d]">{item.title || "Product"}</span>
                                    <span className="mt-0.5 block text-xs text-[#64766a]">
                                      Qty {Number(item.quantity || 1)}
                                      {item.handle && <span className="ml-2">({item.handle})</span>}
                                      {item.itemCategory && <span className="ml-2">- {item.itemCategory}</span>}
                                    </span>
                                  </span>
                                  <span className="whitespace-nowrap text-right font-medium">{inr(Number(item.price || 0) * Number(item.quantity || 1))}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="border-t border-[#e2e8e1] pt-2 text-xs text-[#64766a]">
                              Subtotal {inr(record.subtotal)} - Shipping {inr(record.shipping)} - Discount {inr(record.discount)} - COD fee {inr(record.codFee)} - Wallet used {inr(record.walletAmountApplied)}
                            </div>
                            <p className="font-bold">Payable now: {inr(record.payableAmount)} <span className="font-normal text-[#64766a]">(checkout total {inr(record.totalWithCod)})</span></p>
                            {!!record.paymentAttempts.length && <div className="border-t border-[#e2e8e1] pt-3"><h4 className="font-semibold">Payment attempts</h4><ul className="mt-1 space-y-1 text-xs text-[#64766a]">{record.paymentAttempts.map((attempt, index) => <li key={`${attempt.paymentId || "attempt"}-${index}`}>{attempt.status}{attempt.method ? ` - ${attempt.method}` : ""} - {attempt.paymentId || "no payment id"}{attempt.failureReason ? ` - ${attempt.failureReason}` : ""}</li>)}</ul></div>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {nextCursor && <div className="text-center"><button onClick={() => void load(nextCursor, true)} disabled={loadingMore} className="rounded-xl bg-[#1f4a35] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{loadingMore ? "Loading..." : "Load more checkouts"}</button></div>}
    </section>
  );
}
