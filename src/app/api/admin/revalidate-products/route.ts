import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { invalidateCatalogCache } from "@/lib/commerce";

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const handles = Array.isArray(body?.handles) ? body.handles.map((value: unknown) => String(value ?? "").trim()).filter(Boolean) : [];
    const all = Boolean(body?.all);

    if (all) {
      invalidateCatalogCache();
      revalidatePath("/collections/succulents");
      revalidatePath("/collections/succulents/[handle]", "page");
      revalidatePath("/products/[handle]", "page");
      revalidatePath("/shop");
      revalidatePath("/");
      return NextResponse.json({ ok: true, revalidated: ["/collections/succulents", "/collections/succulents/[handle]", "/products/[handle]", "/shop", "/"] });
    }

    const paths: string[] = [];
    for (const handle of handles) {
      const productPath = `/products/${handle}`;
      const collectionPath = `/collections/succulents/${handle}`;
      revalidatePath(productPath);
      revalidatePath(collectionPath);
      paths.push(productPath, collectionPath);
    }
    if (handles.length) {
      invalidateCatalogCache();
    }

    return NextResponse.json({ ok: true, revalidated: paths });
  } catch (error) {
    return NextResponse.json(
      { error: String((error as Error)?.message || "Revalidation failed") },
      { status: 500 },
    );
  }
}
