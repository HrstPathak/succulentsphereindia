import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Package } from "lucide-react";
import { getAuthenticatedCustomer } from "@/lib/auth";
import { enrichCustomerOrders } from "@/lib/order-enrichment";
import OrdersListClient from "@/components/auth/OrdersListClient";

export const metadata: Metadata = {
  title: "Order History",
  description: "View your order history and payment totals in your Succulent Sphere account.",
  alternates: {
    canonical: "/account/orders",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountOrdersPage() {
  const session = await getAuthenticatedCustomer();
  if (!session.customer) redirect("/login");

  const orders = session.customer.email
    ? await enrichCustomerOrders({ email: session.customer.email, orders: session.customer.orders })
    : session.customer.orders;

  return (
    <section
      className="auth-shell-bg min-h-screen bg-[var(--color-bg)] px-4 pb-16 pt-8"
      style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[28px] border border-[var(--auth-border)] bg-[linear-gradient(150deg,#f7f3ef_0%,#efe8e0_100%)] p-5 shadow-[0_20px_55px_rgba(12,20,14,0.14)] sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--auth-muted)]">Account</p>
              <h1 className="mt-1 font-serif text-4xl text-[var(--color-text)]">All Orders</h1>
              <p className="mt-2 text-sm text-[var(--auth-muted)]">
                {orders.length} {orders.length === 1 ? "order" : "orders"} in your account.
              </p>
            </div>
            <Link
              href="/account"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--auth-border)] bg-white/70 px-3 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-white"
            >
              <ChevronLeft size={16} />
              Back to Account
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-[var(--auth-border)] bg-white/60 p-8 text-center">
              <Package size={26} className="mx-auto text-[var(--color-brand)]" />
              <p className="mt-3 text-base text-[var(--color-text)]">No orders yet</p>
              <p className="mt-1 text-sm text-[var(--auth-muted)]">Once you place an order, it will appear here.</p>
            </div>
          ) : (
            <OrdersListClient orders={orders} />
          )}
        </div>
      </div>
    </section>
  );
}
