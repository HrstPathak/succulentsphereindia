import { notFound, redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata = { title: "Store Control", robots: { index: false, follow: false } };

// Tabs the dashboard is allowed to open directly via ?tab=. Kept in sync with the
// Tab union in AdminDashboard so a typo falls back to the overview instead of
// rendering an empty panel.
const ADMIN_TABS = [
  "overview",
  "products",
  "orders",
  "customers",
  "reviews",
  "mail",
  "blog",
  "automation",
] as const;

type AdminTab = (typeof ADMIN_TABS)[number];

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAdminSession();

  // Redirect to login if not authenticated
  if (!session.uid) {
    redirect("/login?next=/admin");
  }

  // Return 404 if authenticated but not an admin
  if (!session.isAdmin) notFound();

  // Lets deep links such as /admin/orders/[id] send the operator back to the
  // exact tab they came from instead of always landing on Overview.
  const resolved =
    (await Promise.resolve(searchParams)) ??
    ({} as Record<string, string | string[] | undefined>);
  const rawTab = Array.isArray(resolved.tab) ? resolved.tab[0] : resolved.tab;
  const initialTab: AdminTab = ADMIN_TABS.includes(rawTab as AdminTab)
    ? (rawTab as AdminTab)
    : "overview";

  return <AdminDashboard adminEmail={session.email} initialTab={initialTab} />;
}
