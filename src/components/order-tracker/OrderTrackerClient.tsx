"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Box,
  Leaf,
  Loader2,
  PackageCheck,
  Truck,
} from "lucide-react";
import { resolveShippingPresentation } from "@/lib/shippingProgress";
import OrderLineItemsClient from "@/components/auth/OrderLineItemsClient";

type TrackResponse = {
  orderNumber: string;
  orderDate: string;
  trackerStatus: string;
  trackerCaption: string;
  financialStatus: string;
  paymentGatewayNames: string[];
  tags?: string[];
  fulfillmentOrderStatuses?: string[];
  fulfillmentEvents?: string[];
  lineItems: Array<{
    id: string;
    title: string;
    quantity: number;
    productHandle: string;
    image: string;
    imageAlt?: string;
    customAttributes?: { key: string; value: string }[];
    originalTotalPrice?: { amount: string; currencyCode: string };
    discountedTotalPrice?: { amount: string; currencyCode: string };
    price: { amount: string; currencyCode: string };
  }>;
  trackingNumber: string;
  shippingCarrier: string;
  estimatedDelivery: string;
  currentStep: number;
};

type TrackOrderApiSuccess = {
  order?: {
    name?: string;
    processedAt?: string;
    fulfillmentStatus?: string;
    financialStatus?: string;
    tracking?: Array<{
      number?: string;
      url?: string;
      company?: string;
    }>;
    tags?: string[];
    fulfillmentOrderStatuses?: string[];
    fulfillmentEvents?: string[];
    paymentGatewayNames?: string[];
    lineItems?: TrackResponse["lineItems"];
  };
};

type TrackOrderApiError = {
  error?: string | { code?: string; message?: string };
};

const STEPS = [
  { title: "Order Confirmed", Icon: BadgeCheck },
  { title: "In Process", Icon: Box },
  { title: "Shipped", Icon: Truck },
  { title: "Out for Delivery", Icon: PackageCheck },
  { title: "Delivered", Icon: Leaf },
] as const;

function formatOrderDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function OrderTrackerClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ orderNumber?: string; email?: string }>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackResponse | null>(null);

  const safeStep = useMemo(() => {
    if (!result) return -1;
    return Math.max(0, Math.min(STEPS.length - 1, Number(result.currentStep) || 0));
  }, [result]);

  const paymentStatus = useMemo(() => {
    if (!result) return "-";
    const financial = String(result.financialStatus || "").toLowerCase();
    if (financial.includes("deposit")) return "COD (partial paid)";
    if (financial.includes("paid")) return "Paid";
    const gateways = result.paymentGatewayNames.map((name) => name.toLowerCase());
    const isCod = gateways.some((name) => name.includes("cash on delivery") || name === "cod");
    if (isCod) return "COD (Not Paid)";
    return result.financialStatus || "-";
  }, [result]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: { orderNumber?: string; email?: string } = {};
    if (!orderNumber.trim()) nextErrors.orderNumber = "Please enter your order number.";
    if (!email.trim()) {
      nextErrors.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }
    setFieldErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          email: email.trim().toLowerCase(),
        }),
      });
      const payload = (await response.json()) as TrackOrderApiSuccess & TrackOrderApiError;

      if (!response.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : String(payload?.error?.message || "").trim();
        setServerError(
          message || "We couldn't find your order. Please check your details and try again."
        );
        return;
      }

      const order = payload?.order;
      if (!order?.name) {
        setServerError("Invalid order response. Please try again.");
        return;
      }

      const firstTracking = Array.isArray(order.tracking) ? order.tracking[0] : undefined;
      const hasTracking = Boolean(
        String(firstTracking?.number || "").trim() || String(firstTracking?.url || "").trim()
      );
      const shippingProgress = {
        fulfillmentStatus: order?.fulfillmentStatus,
        fulfillmentOrderStatuses: order?.fulfillmentOrderStatuses,
        tags: order?.tags,
        hasTracking,
        fulfillmentEvents: order?.fulfillmentEvents,
      };
      const shippingPresentation = resolveShippingPresentation(shippingProgress);
      const currentStep = shippingPresentation.step;

      const normalized: TrackResponse = {
        orderNumber: String(order.name || orderNumber.trim()),
        orderDate: String(order.processedAt || ""),
        trackerStatus: shippingPresentation.label,
        trackerCaption: shippingPresentation.trackerCaption,
        financialStatus: String(order.financialStatus || "PENDING"),
        paymentGatewayNames: Array.isArray(order.paymentGatewayNames)
          ? order.paymentGatewayNames.map((name) => String(name || "")).filter(Boolean)
          : [],
        tags: Array.isArray(order.tags) ? order.tags.map((tag) => String(tag || "")).filter(Boolean) : [],
        fulfillmentOrderStatuses: Array.isArray(order.fulfillmentOrderStatuses)
          ? order.fulfillmentOrderStatuses.map((status) => String(status || "")).filter(Boolean)
          : [],
        fulfillmentEvents: Array.isArray(order.fulfillmentEvents)
          ? order.fulfillmentEvents.map((event) => String(event || "")).filter(Boolean)
          : [],
        lineItems: Array.isArray(order.lineItems) ? order.lineItems : [],
        trackingNumber: String(firstTracking?.number || ""),
        shippingCarrier: String(firstTracking?.company || ""),
        estimatedDelivery: currentStep >= 4 ? "Delivered" : "Estimated in 5-7 business days",
        currentStep,
      };

      setResult(normalized);
    } catch {
      setServerError("We couldn't find your order. Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="relative min-h-screen overflow-x-clip bg-[var(--color-bg)] px-4 pb-16"
      style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}
    >
      <div className="pointer-events-none absolute -left-24 top-28 h-72 w-72 rounded-full bg-[#dbe8d7]/45 blur-3xl dark:bg-[#1d3a2c]/40" />
      <div className="pointer-events-none absolute -right-20 top-24 h-80 w-80 rounded-full bg-[#f0dac3]/40 blur-3xl dark:bg-[#173144]/45" />

      <div className="mx-auto max-w-5xl">
        <div className="mb-10 rounded-2xl border border-white/30 bg-[linear-gradient(160deg,rgba(163,177,138,0.2)_0%,rgba(203,153,126,0.12)_50%,rgba(52,78,65,0.1)_100%)] px-6 py-12 text-center shadow-[0_30px_60px_-45px_rgba(52,78,65,0.65)] backdrop-blur-md sm:px-10">
          <h1 className="font-playfair text-4xl text-[var(--color-text)] sm:text-5xl">Track Your Order</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--auth-muted)] sm:text-base">
            Follow your succulent&apos;s journey from our greenhouse to your home.
          </p>
        </div>

        <div className="mx-auto max-w-2xl rounded-2xl border border-[rgba(52,78,65,0.15)] bg-white/60 p-6 shadow-[0_24px_50px_-35px_rgba(52,78,65,0.6)] backdrop-blur-xl dark:bg-[#0c1c26]/70 sm:p-8">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="order-number" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                Order Number
              </label>
              <input
                id="order-number"
                type="text"
                value={orderNumber}
                onChange={(e) => {
                  setOrderNumber(e.target.value);
                  if (fieldErrors.orderNumber) setFieldErrors((prev) => ({ ...prev, orderNumber: undefined }));
                }}
                className="w-full rounded-xl border border-[rgba(52,78,65,0.2)] bg-white/85 px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[rgba(52,78,65,0.15)] dark:bg-[#132a37]/70"
                placeholder="#1001"
              />
              {fieldErrors.orderNumber && (
                <p className="mt-1 text-xs text-[#b45353]">{fieldErrors.orderNumber}</p>
              )}
            </div>

            <div>
              <label htmlFor="order-email" className="mb-1 block text-sm font-medium text-[var(--color-text)]">
                Email Address
              </label>
              <input
                id="order-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                className="w-full rounded-xl border border-[rgba(52,78,65,0.2)] bg-white/85 px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[rgba(52,78,65,0.15)] dark:bg-[#132a37]/70"
                placeholder="you@example.com"
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-[#b45353]">{fieldErrors.email}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white transition duration-300 hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Tracking...
                </>
              ) : (
                "Track Order"
              )}
            </button>
          </form>
        </div>

        {serverError && (
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-[rgba(185,28,28,0.35)] bg-[rgba(185,28,28,0.08)] px-5 py-4 text-sm text-[#8f2f2f] dark:border-[rgba(248,113,113,0.4)] dark:bg-[rgba(248,113,113,0.1)] dark:text-[#fecaca]">
            {serverError}
          </div>
        )}

        {result && (
          <div className="fade-in mx-auto mt-10 max-w-4xl rounded-2xl border border-[rgba(52,78,65,0.16)] bg-white/75 p-6 shadow-[0_24px_50px_-35px_rgba(52,78,65,0.55)] backdrop-blur-xl dark:bg-[#0f2130]/70 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoItem label="Order Number" value={result.orderNumber || "-"} />
              <InfoItem label="Order Date" value={formatOrderDate(result.orderDate)} />
              <InfoItem label="Order Status" value={result.trackerStatus || "-"} />
              <InfoItem label="Payment Status" value={paymentStatus} />
              <InfoItem label="Tracking Number" value={result.trackingNumber || "-"} />
              <InfoItem label="Shipping Carrier" value={result.shippingCarrier || "-"} />
              <InfoItem label="Estimated Delivery" value={result.estimatedDelivery || "-"} />
            </div>

            <p className="mt-4 text-sm text-[var(--auth-muted)]">{result.trackerCaption}</p>

            <div className="mt-8 hidden md:block">
              <div className="grid grid-cols-5 gap-3">
                {STEPS.map((step, index) => {
                  const done = index <= safeStep;
                  const Icon = step.Icon;
                  return (
                    <div key={step.title} className="relative text-center">
                      {index < STEPS.length - 1 && (
                        <span
                          className={`absolute left-[55%] top-5 h-[2px] w-[90%] ${done ? "bg-[var(--color-brand)]" : "bg-[#cfd7ca] dark:bg-[#2b4a3d]"}`}
                        />
                      )}
                      <div
                        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full border transition ${
                          done
                            ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                            : "border-[#cfd7ca] bg-[#e7ece2] text-[#6a7c70] dark:border-[#2b4a3d] dark:bg-[#143227] dark:text-[#8FBF94]"
                        }`}
                      >
                        <Icon size={16} />
                      </div>
                      <p className="mt-2 text-xs font-medium text-[var(--color-text)]">{step.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 space-y-4 md:hidden">
              {STEPS.map((step, index) => {
                const done = index <= safeStep;
                const Icon = step.Icon;
                return (
                  <div key={step.title} className="relative flex items-start gap-3">
                    {index < STEPS.length - 1 && (
                      <span
                        className={`absolute left-[18px] top-9 h-[32px] w-[2px] ${done ? "bg-[var(--color-brand)]" : "bg-[#cfd7ca] dark:bg-[#2b4a3d]"}`}
                      />
                    )}
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                        done
                          ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                          : "border-[#cfd7ca] bg-[#e7ece2] text-[#6a7c70] dark:border-[#2b4a3d] dark:bg-[#143227] dark:text-[#8FBF94]"
                      }`}
                    >
                      <Icon size={15} />
                    </div>
                    <p className="pt-1 text-sm font-medium text-[var(--color-text)]">{step.title}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 rounded-2xl border border-[#e3d9ca] bg-white/70 p-4 shadow-[0_16px_30px_-24px_rgba(52,78,65,0.6)]">
              <h3 className="text-lg font-semibold text-[#24372d]">Ordered Products</h3>
              <OrderLineItemsClient
                lineItems={result.lineItems}
                orderNumber={result.orderNumber.replace(/^#/, "")}
                canReview={false}
                showReviews={false}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[rgba(52,78,65,0.12)] bg-white/75 px-4 py-3 dark:bg-[#102637]/65">
      <p className="text-xs uppercase tracking-wide text-[var(--auth-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}
