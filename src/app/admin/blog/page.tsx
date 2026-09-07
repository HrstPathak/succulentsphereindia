import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import BlogAdmin from "@/components/admin/BlogAdmin";

export default async function AdminBlogPage() {
  const session = await getAdminSession();
  if (!session.uid) redirect("/login?next=/admin/blog");
  if (!session.isAdmin) notFound();
  return <BlogAdmin />;
}