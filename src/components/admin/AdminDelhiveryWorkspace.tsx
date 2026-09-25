"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
  Truck,
  User,
  Wallet,
} from "lucide-react";
import {
  buildDelhiveryTrackingUrl,
  parseManualOrderText,
  type ManualOrderDraft,
} from "@/lib/delhiveryTracking";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

type CreatedOrder = {
  orderId: string;
  orderReference: string;
  awb: string;
  name: string;
  pincode: string;
  amount: number;
  paymentMode: string;
};

type StoredOrder = CreatedOrder & {
  id: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  trackingUrl: string;
  createdAt: string;
};

const formatWhen = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
};

const EMPTY: ManualOrderDraft = {
  orderId: "",
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  amount: "",
  paymentMode: "COD",
};

const inputClass =
  "w-full rounded-xl border border-[#dde5dd] bg-white px-4 py-3 text-sm text-[#102419] shadow-sm outline-none transition placeholder:text-[#a9b6a9] focus:border-[#1f4a35] focus:ring-4 focus:ring-[#1f4a35]/10";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-xs font-bold uppercase tracking-[.12em] text-[#6e826f]">
          {label}
        </span>
        {hint ? <span className="text-[11px] text-[#9aa89a]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export default function AdminDelhiveryWorkspace({ adminEmail }: { adminEmail: string }) {
  const [rawText, setRawText] = useState("");
  const [draft, setDraft] = useState<ManualOrderDraft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<CreatedOrder[]>([]);
  const [locationNote, setLocationNote] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [stored, setStored] = useState<StoredOrder[]>([]);
  const [storedLoading, setStoredLoading] = useState(true);
  const [storedError, setStoredError] = useState("");
  const [editing, setEditing] = useState<StoredOrder | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleting, setDeleting] = useState<StoredOrder | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const lastLookup = useRef("");

  const preview = useMemo(() => parseManualOrderText(rawText), [rawText]);

  /**
   * Loads the durable history from Firestore so it survives a page refresh,
   * unlike the in-session list above it.
   */
  const loadStored = useCallback(async () => {
    setStoredLoading(true);
    setStoredError("");
    try {
      const response = await fetch("/api/admin/delhivery/manual-order?limit=25", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Unable to load recent orders.");
      }
      setStored(Array.isArray(payload.orders) ? payload.orders : []);
    } catch (loadError) {
      setStoredError(String((loadError as Error).message || loadError));
    } finally {
      setStoredLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStored();
  }, [loadStored]);

  const missing = useMemo(() => {
    const list: string[] = [];
    if (!draft.orderId) list.push("order ID");
    if (!draft.name) list.push("name");
    if (draft.phone.length !== 10) list.push("phone");
    if (draft.pincode.length !== 6) list.push("pincode");
    if (!draft.address) list.push("address");
    if (!draft.amount) list.push("amount");
    return list;
  }, [draft]);

  const ready = missing.length === 0;

  /**
   * Fills city/state from Delhivery's own serviceability record for the
   * pincode. That data is authoritative, so it beats anything guessed from the
   * pasted address text.
   */
  const lookupLocation = useCallback(async (pincode: string, mode: string) => {
    const clean = String(pincode || "").replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6 || clean === lastLookup.current) return;
    lastLookup.current = clean;
    setLookingUp(true);
    try {
      const response = await fetch(
        `/api/pincode-serviceability?pincode=${encodeURIComponent(clean)}&mode=${
          mode === "COD" ? "COD" : "Prepaid"
        }`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => null);
      if (!data) return;
      if (!data.serviceable) {
        setLocationNote(`Delhivery does not service ${clean}.`);
        return;
      }
      const city = String(data.city || "").trim();
      const state = String(data.state || "").trim();
      setLocationNote(
        [city, state].filter(Boolean).join(", ") || `Location for ${clean}`,
      );
      setDraft((current) => ({
        ...current,
        city: city || current.city,
        state: state || current.state,
      }));
    } catch {
      setLocationNote("");
    } finally {
      setLookingUp(false);
    }
  }, []);

  // Look the pincode up as soon as a full 6-digit pincode is present.
  useEffect(() => {
    if (draft.pincode.length === 6) {
      void lookupLocation(draft.pincode, draft.paymentMode);
    }
  }, [draft.pincode, draft.paymentMode, lookupLocation]);

  function set<K extends keyof ManualOrderDraft>(key: K, value: ManualOrderDraft[K]) {
    if (key === "pincode") lastLookup.current = "";
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function autofill() {
    setDraft({ ...EMPTY, ...preview });
    lastLookup.current = "";
    setLocationNote("");
    setError("");
    if (preview.pincode.length === 6) {
      void lookupLocation(preview.pincode, preview.paymentMode);
    }
  }

  function reset() {
    setRawText("");
    setDraft(EMPTY);
    setLocationNote("");
    lastLookup.current = "";
    setError("");
  }

  function openEdit(order: StoredOrder) {
    setEditing(order);
    setEditError("");
    setEditForm({
      name: order.name || "",
      phone: order.phone || "",
      email: order.email || "",
      address: order.address || "",
      city: order.city || "",
      state: order.state || "",
      pincode: order.pincode || "",
      amount: String(order.amount ?? ""),
      paymentMode: order.paymentMode || "COD",
    });
  }

  function closeEdit() {
    if (editBusy) return;
    setEditing(null);
    setEditError("");
  }

  async function saveEdit() {
    if (!editing) return;
    setEditBusy(true);
    setEditError("");
    try {
      const response = await fetch("/api/admin/delhivery/manual-order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...editForm }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Unable to save the changes.");
      }
      setEditing(null);
      await loadStored();
    } catch (saveError) {
      setEditError(String((saveError as Error).message || saveError));
    } finally {
      setEditBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const response = await fetch(
        `/api/admin/delhivery/manual-order?id=${encodeURIComponent(deleting.id)}`,
        { method: "DELETE" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Unable to delete the order.");
      }
      setDeleting(null);
      await loadStored();
    } catch (deleteError) {
      setStoredError(String((deleteError as Error).message || deleteError));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/delhivery/manual-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, rawText }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Unable to create the Delhivery order.");
      }
      setHistory((current) => [
        {
          orderId: String(payload.orderId),
          orderReference: String(payload.orderReference || payload.orderId),
          awb: String(payload.awb || ""),
          name: draft.name,
          pincode: draft.pincode,
          amount: Number(payload.record?.amount || draft.amount || 0),
          paymentMode: String(payload.record?.paymentMode || draft.paymentMode),
        },
        ...current,
      ]);
      setRawText("");
      setDraft(EMPTY);
      setLocationNote("");
      lastLookup.current = "";
      // Refresh the durable history so the new order appears there too.
      void loadStored();
    } catch (submitError) {
      setError(String((submitError as Error).message || submitError));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#eef2ec] px-4 py-8 text-[#102419] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#1f4a35] text-white shadow-lg shadow-[#1f4a35]/25">
              <Truck className="size-7" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#6e826f]">
                Admin · {adminEmail}
              </p>
              <h1 className="mt-1 font-serif text-3xl leading-tight sm:text-4xl">
                Delhivery order creation
              </h1>
              <p className="mt-1.5 max-w-xl text-sm text-[#5a6b5d]">
                Create Ready to Ship manifests for orders taken over WhatsApp. Paste
                the details, let the fields fill themselves, then ship.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[#d5dfd5] bg-white px-4 py-2.5 text-sm font-semibold text-[#33443a] shadow-sm transition hover:bg-[#f4f7f4]"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              View Store
            </a>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-full border border-[#d5dfd5] bg-white px-4 py-2.5 text-sm font-semibold text-[#33443a] shadow-sm transition hover:bg-[#f4f7f4]"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Command Center
            </Link>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="flex flex-col rounded-3xl border border-[#dde5dd] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <ClipboardPaste className="size-4 text-[#1f4a35]" aria-hidden="true" />
              <h2 className="text-sm font-bold uppercase tracking-[.12em] text-[#6e826f]">
                1 · Paste order
              </h2>
            </div>
            <textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              rows={12}
              spellCheck={false}
              placeholder={"SS-1\nharshit pathak\n9087654321\nhpathak1238@gmail.com\nbhimgola, bhimtal, uttarakhand\n263136"}
              className="mt-3 w-full resize-none rounded-2xl border border-[#e4ebe4] bg-[#f8faf8] p-4 font-mono text-[13px] leading-relaxed text-[#102419] outline-none transition placeholder:text-[#a9b6a9] focus:border-[#1f4a35] focus:bg-white focus:ring-4 focus:ring-[#1f4a35]/10"
            />
            <p className="mt-2 text-xs leading-relaxed text-[#7d8c7e]">
              One detail per line. Labels like <b>Name:</b>, <b>Address:</b>,{" "}
              <b>Pincode:</b> and <b>Total:</b> are understood too.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={autofill}
                disabled={!rawText.trim()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#e6efe6] px-5 py-3 text-sm font-bold text-[#1f4a35] transition hover:bg-[#dae7da] disabled:opacity-40"
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Auto-fill
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-full border border-[#dde5dd] px-4 py-3 text-sm font-semibold text-[#5a6b5d] transition hover:bg-[#f4f7f4]"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Clear
              </button>
            </div>
            <p className="mt-auto pt-4 text-xs text-[#5a6b5d]">
              Ships as <b className="text-[#102419]">Succulents</b> · 14 × 12 × 12 cm ·
              450 gm · pickup <b className="text-[#102419]">Succulent Sphere</b>
            </p>
          </section>
          <section className="flex flex-col rounded-3xl border border-[#dde5dd] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-[#1f4a35]" aria-hidden="true" />
              <h2 className="text-sm font-bold uppercase tracking-[.12em] text-[#6e826f]">
                2 · Confirm details
              </h2>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Order ID">
                <input
                  value={draft.orderId}
                  onChange={(e) => set("orderId", e.target.value)}
                  placeholder="SS-1"
                  className={inputClass}
                />
              </Field>
              <Field label="Phone">
                <input
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="9087654321"
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Customer name">
                  <input
                    value={draft.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Harshit Pathak"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Email" hint="optional">
                <input
                  value={draft.email}
                  onChange={(e) => set("email", e.target.value)}
                  type="email"
                  placeholder="name@example.com"
                  className={inputClass}
                />
              </Field>
              <Field label="Pincode">
                <input
                  value={draft.pincode}
                  onChange={(e) => set("pincode", e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="263136"
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Full address">
                  <textarea
                    value={draft.address}
                    onChange={(e) => set("address", e.target.value)}
                    rows={2}
                    placeholder="House, street, city, state"
                    className={`${inputClass} resize-none`}
                  />
                </Field>
              </div>
              <Field label="City">
                <input
                  value={draft.city}
                  onChange={(e) => set("city", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="State">
                <input
                  value={draft.state}
                  onChange={(e) => set("state", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                {lookingUp ? (
                  <p className="flex items-center gap-2 rounded-xl bg-[#f2f7f2] px-3 py-2 text-xs text-[#4a5a4f]">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    Checking {draft.pincode} with Delhivery…
                  </p>
                ) : locationNote ? (
                  <p className="flex items-center gap-2 rounded-xl bg-[#eef5ee] px-3 py-2 text-xs text-[#2f5a3d]">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    City and state filled from Delhivery for {draft.pincode}:{" "}
                    {locationNote}
                  </p>
                ) : null}
              </div>
              <Field label="Amount (₹)">
                <input
                  value={draft.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  inputMode="decimal"
                  placeholder="1200"
                  className={inputClass}
                />
              </Field>
              <Field label="Payment">
                <select
                  value={draft.paymentMode}
                  onChange={(e) =>
                    set("paymentMode", e.target.value as ManualOrderDraft["paymentMode"])
                  }
                  className={inputClass}
                >
                  <option value="COD">COD — collect</option>
                  <option value="Prepaid">Prepaid — paid</option>
                </select>
              </Field>
            </div>

            {error ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </p>
            ) : null}

            <div className="sticky bottom-4 mt-5">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || !ready}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#1f4a35] px-6 py-4 text-sm font-bold text-white shadow-lg shadow-[#1f4a35]/20 transition hover:bg-[#163726] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Package className="size-4" aria-hidden="true" />
                )}
                {busy
                  ? "Creating on Delhivery…"
                  : ready
                    ? "Create Delhivery order"
                    : `Add ${missing.join(", ")}`}
              </button>
            </div>
          </section>
        </div>
        <section className="mt-5 rounded-3xl border border-[#dde5dd] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-[#1f4a35]" aria-hidden="true" />
            <h2 className="text-sm font-bold uppercase tracking-[.12em] text-[#6e826f]">
              Created this session
            </h2>
          </div>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-[#7d8c7e]">
              No orders created yet in this session.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[#eef2ee]">
              {history.map((entry) => (
                <li
                  key={entry.awb}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm"
                >
                  <span className="inline-flex items-center gap-1.5 font-bold text-[#1f4a35]">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    {entry.orderReference}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#5a6b5d]">
                    <User className="size-3.5" aria-hidden="true" />
                    {entry.name}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#5a6b5d]">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {entry.pincode}
                  </span>
                  <span className="text-[#5a6b5d]">
                    ₹{entry.amount} · {entry.paymentMode}
                  </span>
                  <span className="ml-auto font-mono font-bold text-[#102419]">
                    {entry.awb}
                  </span>
                  <a
                    href={buildDelhiveryTrackingUrl(entry.awb)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#1f4a35] underline underline-offset-2"
                  >
                    Track ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Durable history read from Firestore; survives a page refresh. */}
        <section className="mt-5 rounded-3xl border border-[#dde5dd] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-[#1f4a35]" aria-hidden="true" />
              <h2 className="text-sm font-bold uppercase tracking-[.12em] text-[#6e826f]">
                Recent orders
              </h2>
              <span className="rounded-full bg-[#eef3ee] px-2 py-0.5 text-[11px] font-bold text-[#4a5a4f]">
                {stored.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void loadStored()}
              disabled={storedLoading}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#dde5dd] px-3 py-1.5 text-xs font-semibold text-[#5a6b5d] transition hover:bg-[#f4f7f4] disabled:opacity-50"
            >
              <RotateCcw
                className={`size-3.5 ${storedLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
          <p className="mt-1.5 text-xs text-[#8a9a8c]">
            Saved in Firestore under <code>manualOrders</code>. This list stays after
            you close or refresh the page.
          </p>

          {storedError ? (
            <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {storedError}
            </p>
          ) : storedLoading && stored.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[#7d8c7e]">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading recent orders…
            </p>
          ) : stored.length === 0 ? (
            <p className="mt-3 text-sm text-[#7d8c7e]">
              No manual orders saved yet. Create one above and it will appear here.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[#eef2ee]">
              {stored.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm"
                >
                  <span className="inline-flex items-center gap-1.5 font-bold text-[#1f4a35]">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    {entry.orderReference}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#5a6b5d]">
                    <User className="size-3.5" aria-hidden="true" />
                    {entry.name}
                  </span>
                  {entry.phone ? (
                    <span className="font-mono text-[#5a6b5d]">{entry.phone}</span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 text-[#5a6b5d]">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {[entry.city, entry.state].filter(Boolean).join(", ") ||
                      entry.pincode}
                  </span>
                  <span className="text-[#5a6b5d]">
                    ₹{entry.amount} · {entry.paymentMode}
                  </span>
                  {entry.createdAt ? (
                    <span className="text-xs text-[#9aa89a]">
                      {formatWhen(entry.createdAt)}
                    </span>
                  ) : null}
                  <span className="ml-auto font-mono font-bold text-[#102419]">
                    {entry.awb}
                  </span>
                  {entry.trackingUrl ? (
                    <a
                      href={entry.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#1f4a35] underline underline-offset-2"
                    >
                      Track ↗
                    </a>
                  ) : null}
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(entry)}
                      aria-label={`Edit ${entry.orderReference}`}
                      title="Edit order details"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#dde5dd] px-2.5 py-1 text-xs font-semibold text-[#1f4a35] transition hover:bg-[#eef3ee] disabled:opacity-50"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(entry)}
                      aria-label={`Delete ${entry.orderReference}`}
                      title="Delete this record"
                      className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AdminConfirmModal
        open={Boolean(editing)}
        title={`Edit ${editing?.orderReference || "order"}`}
        eyebrow="Manual order"
        tone="info"
        message="Updates the saved record only. The shipment already created in Delhivery keeps its original details, and the AWB stays the same."
        confirmLabel={editBusy ? "Saving…" : "Save changes"}
        cancelLabel="Cancel"
        busy={editBusy}
        onConfirm={() => void saveEdit()}
        onCancel={closeEdit}
      >
        {editing ? (
          <>
            {editing.awb ? (
              <p className="rounded-2xl bg-[#f4f7f4] px-4 py-2.5 text-xs text-[#5a6b5d]">
                AWB{" "}
                <span className="font-mono font-bold text-[#102419]">
                  {editing.awb}
                </span>{" "}
                stays the same.
              </p>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  { key: "name", label: "Name" },
                  { key: "phone", label: "Phone" },
                  { key: "email", label: "Email" },
                  { key: "pincode", label: "Pincode" },
                  { key: "city", label: "City" },
                  { key: "state", label: "State" },
                ] as const
              ).map((field) => (
                <label key={field.key} className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#93a393]">
                    {field.label}
                  </span>
                  <input
                    value={editForm[field.key] ?? ""}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        [field.key]: event.target.value,
                      }))
                    }
                    disabled={editBusy}
                    className="mt-1 w-full rounded-xl border border-[#dde5dd] px-3 py-2 text-sm text-[#102419] outline-none transition focus:border-[#1f4a35] focus:ring-2 focus:ring-[#1f4a35]/15 disabled:opacity-60"
                  />
                </label>
              ))}
              <label className="block sm:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#93a393]">
                  Address
                </span>
                <input
                  value={editForm.address ?? ""}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, address: event.target.value }))
                  }
                  disabled={editBusy}
                  className="mt-1 w-full rounded-xl border border-[#dde5dd] px-3 py-2 text-sm text-[#102419] outline-none transition focus:border-[#1f4a35] focus:ring-2 focus:ring-[#1f4a35]/15 disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#93a393]">
                  Amount
                </span>
                <input
                  value={editForm.amount ?? ""}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      amount: event.target.value.replace(/[^\d.]/g, ""),
                    }))
                  }
                  disabled={editBusy}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-[#dde5dd] px-3 py-2 text-sm text-[#102419] outline-none transition focus:border-[#1f4a35] focus:ring-2 focus:ring-[#1f4a35]/15 disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#93a393]">
                  Payment
                </span>
                <select
                  value={editForm.paymentMode ?? "COD"}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, paymentMode: event.target.value }))
                  }
                  disabled={editBusy}
                  className="mt-1 w-full rounded-xl border border-[#dde5dd] bg-white px-3 py-2 text-sm text-[#102419] outline-none transition focus:border-[#1f4a35] focus:ring-2 focus:ring-[#1f4a35]/15 disabled:opacity-60"
                >
                  <option value="COD">COD</option>
                  <option value="Prepaid">Prepaid</option>
                </select>
              </label>
            </div>
            {editError ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {editError}
              </p>
            ) : null}
          </>
        ) : null}
      </AdminConfirmModal>

      <AdminConfirmModal
        open={Boolean(deleting)}
        title="Delete this order?"
        eyebrow="Manual order"
        tone="danger"
        message={
          deleting
            ? `${deleting.orderReference} · ${deleting.name} · AWB ${
                deleting.awb || "—"
              } will be removed from your saved list. The shipment in Delhivery is not cancelled.`
            : ""
        }
        confirmLabel={deleteBusy ? "Deleting…" : "Delete order"}
        cancelLabel="Keep it"
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleteBusy) setDeleting(null);
        }}
      />
    </main>
  );
}
