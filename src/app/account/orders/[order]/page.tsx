import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BadgeCheck, Box, ChevronLeft, ExternalLink, Leaf, PackageCheck, Truck } from "lucide-react";
import { getAuthenticatedCustomer } from "@/lib/auth";
import { fetchDelhiveryTrackingEvent } from "@/lib/delhivery";
import {
  resolveShippingPresentation,
  isDelivered as isShippingDelivered,
} from "@/lib/shippingProgress";
import type { FirebaseCustomerOrder } from "@/lib/commerce";
import OrderLineItemsClient from "@/components/auth/OrderLineItemsClient";

export const metadata: Metadata = {
  title: "Order Details",
  description: "View order details, products, and shipping status for your purchase.",
  robots: {
    index: false,
    follow: false,
  },
};

type PageParams = {
  order?: string;
};

function formatOrderDate(value: string) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatPrice(amount: string, currencyCode: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currencyCode} ${amount}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(value);
}

function normalizeStatus(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

const TRACK_STEPS = [
  { title: "Order Confirmed", Icon: BadgeCheck },
  { title: "In Process", Icon: Box },
  { title: "Shipped", Icon: Truck },
  { title: "Out for Delivery", Icon: PackageCheck },
  { title: "Delivered", Icon: Leaf },
] as const;

function prettyStatus(value: string): string {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function extractCodMeta(lineItems: FirebaseCustomerOrder["lineItems"]) {
  for (const item of lineItems) {
    const attrs = Array.isArray(item.customAttributes) ? item.customAttributes : [];
    const paymentMode = attrs.find((attr) => attr.key === "payment_mode")?.value;
    if (paymentMode === "cod_deposit") {
      const depositRaw = attrs.find((attr) => attr.key === "cod_deposit")?.value || "100";
      const balanceRaw = attrs.find((attr) => attr.key === "cod_balance")?.value || "0";
      const deposit = Number(depositRaw) || 100;
      const balance = Number(balanceRaw) || 0;
      return { isCod: true, deposit, balance };
    }
  }
  return { isCod: false, deposit: 0, balance: 0 };
}

function isReviewEligible(status: string): boolean {
  const normalized = normalizeStatus(status);
  return normalized === "FULFILLED" || normalized.includes("DELIVERED");
}

function resolveOrder(orders: FirebaseCustomerOrder[], orderParam: string): FirebaseCustomerOrder | null {
  const normalizedParam = String(orderParam || "").replace(/^#/, "").trim();
  return orders.find((order) => String(order.orderNumber || "").trim() === normalizedParam) || null;
}

export default async function AccountOrderDetailPage({
  params,
}: {
  params: PageParams | Promise<PageParams>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const orderParam = decodeURIComponent(String(resolvedParams?.order || "")).trim();

  if (!orderParam) {
    notFound();
  }

  const session = await getAuthenticatedCustomer();
  if (!session.customer) {
    redirect("/login");
  }

  const order = resolveOrder(session.customer.orders, orderParam);
  if (!order) {
    notFound();
  }

  const trackingEntries = order.tracking || [];
  const hasTracking = trackingEntries.some((entry) => entry.number || entry.url);
  const firstTracking = trackingEntries[0];
  const delhiveryEvent = firstTracking?.number
    ? await fetchDelhiveryTrackingEvent({
        trackingNumber: String(firstTracking.number || "").trim(),
        company: String(firstTracking.company || "").trim(),
      })
    : null;
  const combinedFulfillmentEvents = delhiveryEvent
    ? [delhiveryEvent]
    : Array.from(
        new Set(
          [...(order.fulfillmentEvents || [])]
            .map((event) => String(event || "").trim())
            .filter(Boolean)
        )
      );
  const shippingProgress = {
    fulfillmentStatus: order.fulfillmentStatus,
    fulfillmentOrderStatuses: order.fulfillmentOrderStatuses,
    tags: order.tags,
    hasTracking,
    fulfillmentEvents: combinedFulfillmentEvents,
  };
  const shippingPresentation = resolveShippingPresentation(shippingProgress);
  const trackingStep = shippingPresentation.step;
  const deliveredByProgress = isShippingDelivered(shippingProgress);
  const canReview = isReviewEligible(order.fulfillmentStatus) || deliveredByProgress;
  const codMeta = extractCodMeta(order.lineItems);
  const orderTotalAmount = Number(order.currentTotalPrice?.amount || order.totalPrice.amount || 0);
  const subtotalAmount = Number(order.currentSubtotalPrice?.amount || order.totalPrice.amount || 0);
  const taxAmount = Number(order.currentTotalTax?.amount || 0);
  const rawShippingAmount = Number(order.currentTotalShippingPrice?.amount || 0);
  const derivedShippingAmount =
    rawShippingAmount > 0 ? rawShippingAmount : Math.max(orderTotalAmount - subtotalAmount - taxAmount, 0);
  const shippingAmount = Number.isFinite(derivedShippingAmount) ? derivedShippingAmount : 0;
  const codBalance = codMeta.isCod ? Math.max(codMeta.balance || orderTotalAmount - codMeta.deposit, 0) : 0;
  const normalizedFinancial = normalizeStatus(order.financialStatus);
  const financialLabel = codMeta.isCod
    ? normalizedFinancial === "PAID"
      ? "COD (Paid in Full)"
      : "COD (Deposit Paid)"
    : prettyStatus(order.financialStatus);
  const isDelivered = deliveredByProgress;
  const paymentMethodLabel = codMeta.isCod ? "Cash on Delivery" : "Paid Online (Razorpay)";
  const paymentMethodDescription = codMeta.isCod
    ? isDelivered
      ? "This order was placed on COD. Your ₹100 security deposit was received, and the remaining balance was collected at delivery."
      : "This order is placed on COD. Your ₹100 security deposit is received, and the remaining balance will be collected at delivery."
    : "This order was prepaid securely via Razorpay.";

  return (
    <section
      className="relative min-h-screen overflow-x-clip bg-[var(--color-bg)] px-4 pb-16"
      style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}
    >
      <div className="pointer-events-none absolute -left-24 top-28 h-72 w-72 rounded-full bg-[#dbe8d7]/45 blur-3xl dark:bg-[#1d3a2c]/40" />
      <div className="pointer-events-none absolute -right-20 top-24 h-80 w-80 rounded-full bg-[#f0dac3]/40 blur-3xl dark:bg-[#173144]/45" />

      <div className="mx-auto max-w-5xl space-y-8 sm:space-y-10">
        <div className="relative overflow-hidden rounded-[28px] border border-white/35 bg-[linear-gradient(155deg,rgba(163,177,138,0.2)_0%,rgba(244,232,216,0.8)_42%,rgba(203,153,126,0.18)_100%)] px-6 py-8 shadow-[0_35px_70px_-45px_rgba(52,78,65,0.7)] backdrop-blur-md sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/35 blur-3xl" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--auth-muted)]">Order Details</p>
              <h1 className="mt-1 font-playfair text-4xl text-[var(--color-text)] sm:text-5xl">#{order.orderNumber}</h1>
              <p className="mt-2 text-sm text-[var(--auth-muted)]">Placed on {formatOrderDate(order.processedAt)}</p>
            </div>
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-1 rounded-xl border border-[rgba(52,78,65,0.18)] bg-white/85 px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-[0_10px_20px_-18px_rgba(36,55,45,0.9)] transition hover:bg-white"
            >
              <ChevronLeft size={16} />
              Back to Orders
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-[rgba(52,78,65,0.1)] bg-[linear-gradient(150deg,rgba(255,255,255,0.96)_0%,rgba(247,242,234,0.94)_100%)] p-1.5 shadow-[0_20px_36px_-30px_rgba(52,78,65,0.55)]">
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#e3d9ca] bg-white/95">
              <div className="px-4 py-3 sm:px-5 sm:py-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#6b766a]">Financial Status</p>
                <p className="mt-1.5 text-base font-semibold text-[#24372d] sm:text-lg">{financialLabel}</p>
              </div>
              <div className="border-l border-[#e8dece] px-4 py-3 sm:px-5 sm:py-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#6b766a]">Order Total</p>
                <p className="mt-1.5 text-base font-semibold text-[#24372d] sm:text-lg">
                  {formatPrice(order.totalPrice.amount, order.totalPrice.currencyCode)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 overflow-hidden rounded-[28px] border border-[rgba(52,78,65,0.2)] bg-white/92 p-6 shadow-[0_30px_65px_-40px_rgba(35,58,48,0.55)] backdrop-blur-xl sm:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#a5b396_0%,#dcb89a_55%,#8ea181_100%)]" />
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-playfair text-3xl text-[var(--color-text)]">Shipping Details</h2>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#6a786e]">Delivery Timeline</p>
          </div>
          <div className="mt-5 rounded-xl border border-[#e3d9ca] bg-[linear-gradient(160deg,rgba(255,255,255,0.96)_0%,rgba(249,245,238,0.95)_100%)] px-4 py-3 sm:px-5">
            <InfoItem label="Order Status" value={shippingPresentation.label} compact />
            <p className="mt-3 text-sm text-[#4e5e54]">{shippingPresentation.trackerCaption}</p>
          </div>

          <div className="mt-8 hidden md:block">
            <div className="grid grid-cols-5 gap-3">
              {TRACK_STEPS.map((step, index) => {
                const done = index <= trackingStep;
                const Icon = step.Icon;
                return (
                  <div key={step.title} className="relative text-center">
                    {index < TRACK_STEPS.length - 1 && (
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
                    <p className="mt-2 text-xs font-medium tracking-[0.01em] text-[var(--color-text)]">{step.title}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 space-y-4 md:hidden">
            {TRACK_STEPS.map((step, index) => {
              const done = index <= trackingStep;
              const Icon = step.Icon;
              return (
                <div key={step.title} className="relative flex items-start gap-3">
                  {index < TRACK_STEPS.length - 1 && (
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

          <div className="mt-6 space-y-2">
            {trackingEntries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#d8cbb9] bg-[#faf7f1] p-4 text-sm text-[#4e5e54]">
                {shippingPresentation.isOnHold
                  ? "This order is currently on hold, so tracking information is not available yet."
                  : "Tracking information is not available yet."}
              </p>
            ) : (
              trackingEntries.map((entry, index) => (
                <div key={`${entry.number}-${index}`} className="rounded-xl border border-[#e3d9ca] bg-white/80 p-3">
                  <p className="text-sm font-semibold text-[#24372d]">Shipment {index + 1}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <InfoItem label="Carrier" value={entry.company || "-"} compact />
                    <InfoItem label="Tracking Number" value={entry.number || "-"} compact />
                    <div className="rounded-lg border border-[#e3d9ca] bg-white/90 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#6b766a]">Tracking URL</p>
                      {entry.url ? (
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)] hover:underline"
                        >
                          Open link
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <p className="mt-1 text-xs font-semibold text-[#24372d]">-</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div id="products" className="rounded-2xl border border-[rgba(52,78,65,0.16)] bg-white/75 p-6 shadow-[0_24px_50px_-35px_rgba(52,78,65,0.55)] backdrop-blur-xl sm:p-8">
          <h2 className="font-playfair text-3xl text-[var(--color-text)]">Product Details</h2>
          {order.lineItems.length === 0 ? (
            <p className="mt-4 rounded-xl border border-[#e2d8c9] bg-white/70 p-4 text-sm text-[#4e5e54]">
              Product details are unavailable for this order.
            </p>
          ) : (
            <OrderLineItemsClient
              lineItems={order.lineItems}
              orderNumber={String(order.orderNumber || "")}
              canReview={canReview}
            />
          )}
        </div>

        <div className="rounded-2xl border border-[rgba(52,78,65,0.16)] bg-white/75 p-6 shadow-[0_24px_50px_-35px_rgba(52,78,65,0.55)] backdrop-blur-xl sm:p-8">
          <h2 className="font-playfair text-3xl text-[var(--color-text)]">Order Summary</h2>
          <div className="mt-4 space-y-2 text-sm text-[#2f4438]">
            <SummaryRow
              label="Plants total"
              value={formatPrice(
                order.currentSubtotalPrice?.amount || order.totalPrice.amount,
                order.currentSubtotalPrice?.currencyCode || order.totalPrice.currencyCode
              )}
            />
            <SummaryRow
              label="Shipping"
              value={formatPrice(
                shippingAmount.toFixed(2),
                order.currentTotalShippingPrice?.currencyCode || order.totalPrice.currencyCode
              )}
            />
            {order.currentTotalTax ? (
              <SummaryRow
                label="Tax"
                value={formatPrice(order.currentTotalTax.amount, order.currentTotalTax.currencyCode)}
              />
            ) : null}
            {codMeta.isCod ? (
              <>
                <SummaryRow
                  label="COD Security Deposit (Paid)"
                  value={formatPrice(codMeta.deposit.toFixed(2), order.totalPrice.currencyCode)}
                />
                <SummaryRow
                  label="Balance Due on Delivery"
                  value={formatPrice(codBalance.toFixed(2), order.totalPrice.currencyCode)}
                />
              </>
            ) : null}
            <div className="border-t border-[#e3d9ca] pt-2">
              <SummaryRow
                label="Total"
                value={formatPrice(
                  order.currentTotalPrice?.amount || order.totalPrice.amount,
                  order.currentTotalPrice?.currencyCode || order.totalPrice.currencyCode
                )}
                strong
              />
            </div>
            <div className="pt-6 text-sm text-[#3a5144]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b766a]">Payment Method</p>
              <p className="mt-1 text-base font-semibold text-[#24372d]">{paymentMethodLabel}</p>
              <p className="mt-2 leading-relaxed text-[#4a5b51]">{paymentMethodDescription}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoItem({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-[#e3d9ca] bg-white/90 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-[#6b766a]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#24372d]">{value || "-"}</p>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "text-base font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
