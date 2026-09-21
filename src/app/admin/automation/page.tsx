import { notFound, redirect } from "next/navigation";
import AdminBlogAutomation from "@/components/admin/AdminBlogAutomation";
import { getAdminSession } from "@/lib/admin-auth";

export const metadata = { title: "Blog Automation", robots: { index: false, follow: false } };

export default async function AdminAutomationPage() {
  const session = await getAdminSession();

  // Redirect to login if not authenticated
  if (!session.uid) {
    redirect("/login?next=/admin/automation");
  }

  // Return 404 if authenticated but not an admin
  if (!session.isAdmin) notFound();

  return <AdminBlogAutomation />;
}