import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

const clean = (value: unknown) => String(value || "").trim();

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const { ids, changes } = await request.json();
    const productIds = Array.isArray(ids) ? [...new Set(ids.map(clean).filter(Boolean))].slice(0, 400) : [];
    if (!productIds.length) return NextResponse.json({ error: "Select at least one product." }, { status: 400 });
    const input = changes && typeof changes === "object" ? changes : {};
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (input.price !== undefined && Number.isFinite(Number(input.price)) && Number(input.price) >= 0) update.price = Number(input.price);
    if (input.inventoryQuantity !== undefined && Number.isFinite(Number(input.inventoryQuantity)) && Number(input.inventoryQuantity) >= 0) update.inventoryQuantity = Math.floor(Number(input.inventoryQuantity));
    if (typeof input.available === "boolean") update.available = input.available;
    if (["active", "draft", "archived", "unlisted"].includes(clean(input.status).toLowerCase())) update.status = clean(input.status).toLowerCase();
    if (typeof input.tags === "string") update.tags = input.tags.split(",").map((tag: string) => tag.trim()).filter(Boolean).slice(0, 50);
    if (Object.keys(update).length === 1) return NextResponse.json({ error: "Choose at least one change to apply." }, { status: 400 });
    const db = getFirebaseDb(); const batch = db.batch();
    productIds.forEach((id) => batch.update(db.collection("products").doc(id), update));
    await batch.commit();
    return NextResponse.json({ ok: true, updated: productIds.length });
  } catch (error) { return NextResponse.json({ error: String((error as Error).message) === "ADMIN_REQUIRED" ? "Not found." : (error as Error).message }, { status: String((error as Error).message) === "ADMIN_REQUIRED" ? 404 : 500 }); }
}
