import type { Metadata } from "next";
import OrderPlacedStatusCard from "./OrderPlacedStatusCard";

type Params = {
  orderId?: string;
  paymentId?: string;
  amount?: string;
  paymentMode?: string;
  orderNumber?: string;
};

export const metadata: Metadata = {
  title: "Order Confirmation",
  description: "Your order is confirmed. Track order details and continue shopping on Succulent Sphere.",
  alternates: {
    canonical: "/order-placed",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrderPlacedPage({
  searchParams,
}: {
  searchParams: Params | Promise<Params>;
}) {
  const resolvedParams = await Promise.resolve(searchParams);
  const orderId = resolvedParams.orderId || "-";
  const paymentId = resolvedParams.paymentId || "-";
  const amount = resolvedParams.amount || "0.00";
  const paymentMode = String(resolvedParams.paymentMode || "").trim();
  const amountNumber = Number(amount) || 0;
  const orderNumber = Number(resolvedParams.orderNumber) || undefined;

  return (
    <section
      className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f7f3eb_0%,#f2ede3_45%,#ede8de_100%)] pb-14"
      style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}
    >
      <div className="pointer-events-none absolute -left-24 top-20 h-64 w-64 rounded-full bg-[#dbe8d7]/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-28 h-72 w-72 rounded-full bg-[#f0dac3]/45 blur-3xl" />

      <div className="container mx-auto max-w-2xl px-4">
        <OrderPlacedStatusCard
          razorpayOrderId={orderId}
          paymentId={paymentId}
          amount={amountNumber}
          paymentMode={paymentMode}
          initialOrderNumber={orderNumber}
        />
      </div>
    </section>
  );
}
