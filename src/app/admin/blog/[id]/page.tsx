import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import BlogEditor from "@/components/admin/BlogEditor";

export default async function AdminBlogEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session.uid) redirect("/login?next=/admin/blog");
  if (!session.isAdmin) notFound();
  const { id } = await params;
  return <BlogEditor articleId={id} />;
}