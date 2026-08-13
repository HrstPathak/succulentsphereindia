import { notFound } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata = { title: "Store Control", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session.isAdmin) notFound();
  return <AdminDashboard adminEmail={session.email} />;
}
