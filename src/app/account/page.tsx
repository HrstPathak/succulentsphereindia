import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AccountDashboard from "@/components/auth/AccountDashboard";
import { getAdminSession } from "@/lib/admin-auth";
import { enrichCustomerOrders } from "@/lib/order-enrichment";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your Succulent Sphere profile, addresses, wishlist, and orders from your account dashboard.",
  alternates: {
    canonical: "/account",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountPage() {
  // Fetch only the 3 orders this page renders (dashboard shows maxItems={3}).
  // Previously the full order history (every doc, full lineItems) was pulled
  // on every /account view; full history lives on /account/orders.
  //
  // This page needs the REAL profile (name, email, addresses, 3 orders), so it
  // must use hydrateProfile. getAdminSession() on its own now returns identity
  // only - zero Firestore reads - because every admin API route calls it purely
  // to check one email against ADMIN_EMAILS.
  //
  // walletTransactionLimit mirrors the WalletSection display slice, which is
  // `transactions.slice(0, 12)`. Asking for more would be reads nobody sees.
  // The balance is computed from unspent credits directly and is unaffected by
  // this number, so a small history slice is safe here.
  const session = await getAdminSession({
    orderLimit: 3,
    walletTransactionLimit: 12,
    hydrateProfile: true,
  });
  if (!session.customer) {
    redirect("/login");
  }

  // enrichCustomerOrders is currently a pass-through, kept for when tracking
  // enrichment returns.
  let customer = session.customer;
  if (customer.email) {
    const orders = await enrichCustomerOrders({ email: customer.email, orders: customer.orders });
    customer = { ...customer, orders };
  }

  return <AccountDashboard customer={customer} isGoogleLogin={false} isAdmin={session.isAdmin} />;
}
