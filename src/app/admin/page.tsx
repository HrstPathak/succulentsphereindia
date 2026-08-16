import { notFound, redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata = { title: "Store Control", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const session = await getAdminSession();
  
  // Redirect to login if not authenticated
  if (!session.uid) {
    redirect("/login?next=/admin");
  }
  
  // Return 404 if authenticated but not an admin
  if (!session.isAdmin) notFound();
  
  return <AdminDashboard adminEmail={session.email} />;
}
