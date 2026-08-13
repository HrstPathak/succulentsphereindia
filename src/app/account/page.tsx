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
  const session = await getAdminSession();
  if (!session.customer) {
    redirect("/login");
  }

  let customer = session.customer;
  if (customer.email) {
    const orders = await enrichCustomerOrders({ email: customer.email, orders: customer.orders });
    customer = { ...customer, orders };
  }

  return <AccountDashboard customer={customer} isGoogleLogin={false} isAdmin={session.isAdmin} />;
}
