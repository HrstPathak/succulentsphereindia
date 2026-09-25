import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import AdminDelhiveryWorkspace from "@/components/admin/AdminDelhiveryWorkspace";

export const metadata = {
  title: "Delhivery Orders · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminDelhiveryPage() {
  const session = await getAdminSession();

  if (!session.uid) {
    redirect("/login?next=/admin/delhivery");
  }

  if (!session.isAdmin) notFound();

  return <AdminDelhiveryWorkspace adminEmail={session.email} />;
}