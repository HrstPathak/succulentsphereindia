import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

const clean = (value: unknown) => String(value || "").trim();
const safeNumber = (value: unknown, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const list = (value: unknown) => Array.isArray(value) ? value.map((item) => clean(item)).filter(Boolean) : typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
const toHandle = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150);

async function uploadProductImage(file: File) {
  const endpoint = String(process.env.HOSTINGER_UPLOAD_URL || "").trim();
  const token = String(process.env.HOSTINGER_UPLOAD_TOKEN || "").trim();
  if (!endpoint) return "";

  try {
    const form = new FormData();
    form.append("file", file, file.name || "product-image");
    if (token) form.append("token", token);
    const dir = String(process.env.HOSTINGER_UPLOAD_DIR || "sites/images").trim();
    if (dir) form.append("path", dir);

    const response = await fetch(endpoint, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    const rawText = await response.text();
    let payload: any = null;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = null;
    }
    const directUrl = String(payload?.url || payload?.imageUrl || payload?.data?.url || payload?.path || "").trim();
    if (response.ok && directUrl) {
      return directUrl.startsWith("http") ? directUrl : `${String(process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://whitesmoke-cattle-754161.hostingersite.com").replace(/\/+$/, "")}/${directUrl.replace(/^\/+/, "")}`;
    }
    if (response.ok && typeof payload?.filename === "string") {
      const base = String(process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://whitesmoke-cattle-754161.hostingersite.com").replace(/\/+$/, "");
      return `${base}/${dir.replace(/^\/+/, "")}/${payload.filename.replace(/^\/+/, "")}`;
    }
    throw new Error(payload?.error || payload?.message || `Image upload failed (${response.status})`);
  } catch (error) {
    console.warn("Hostinger upload failed, falling back to provided image url:", (error as Error).message || error);
    return "";
  }
}

async function uploadProductImages(files: File[]) {
  const uploads = await Promise.all(files.map(async (file) => {
    if (!(file instanceof File)) return "";
    return uploadProductImage(file);
  }));
  return uploads.filter(Boolean);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const contentType = request.headers.get("content-type") || "";
    let input: Record<string, any> = {};
    let uploadedImage = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const flatEntries = Array.from(form.entries()).map(([key, value]) => [key, typeof value === "string" ? value : value.name]);
      input = Object.fromEntries(flatEntries);
      const files = form.getAll("imageFiles").filter((value): value is File => value instanceof File && value.size > 0);
      if (files.length) {
        const uploaded = await uploadProductImages(files);
        const existingImages = list(input.images || input.image || "");
        const merged = [...existingImages, ...uploaded].filter(Boolean);
        input.images = merged;
        uploadedImage = merged[0] || "";
      }
      const singleFile = form.get("imageFile");
      if (singleFile && typeof singleFile !== "string" && singleFile instanceof File && singleFile.size > 0) {
        uploadedImage = await uploadProductImage(singleFile);
      }
    } else {
      input = await request.json();
    }

    const title = clean(input.title);
    const handle = toHandle(clean(input.handle || title));
    const description = clean(input.description);
    const price = safeNumber(input.price, 0);
    const compareAtPrice = input.compareAtPrice === "" || input.compareAtPrice == null ? null : safeNumber(input.compareAtPrice, -1);
    const inventoryQuantity = Math.max(0, Math.floor(safeNumber(input.inventoryQuantity, 0)));
    const status = clean(input.status || "active").toLowerCase();
    const available = input.available === undefined ? true : Boolean(input.available);

    if (!title) return NextResponse.json({ error: "Product title is required." }, { status: 400 });
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Price must be a valid positive number." }, { status: 400 });
    if (compareAtPrice !== null && (Number.isNaN(compareAtPrice) || compareAtPrice < 0)) return NextResponse.json({ error: "Compare-at price is invalid." }, { status: 400 });
    if (!"active,draft,archived,unlisted,sold out".split(",").includes(status)) return NextResponse.json({ error: "Status must be active, draft, archived, unlisted, or sold out." }, { status: 400 });

    const db = getFirebaseDb();
    const productRef = db.collection("products").doc();
    const gallery = [...new Set([...(list(input.images || input.image), uploadedImage ? [uploadedImage] : []), clean(input.image)].filter(Boolean))];
    const normalizedImage = gallery[0] || uploadedImage || clean(input.image);
    const productTags = list(input.tags).slice(0, 100);
    const productData = {
      id: productRef.id,
      title,
      handle,
      description,
      price,
      compareAtPrice: compareAtPrice === null ? null : Number(compareAtPrice),
      currency: clean(input.currency || "INR"),
      inventoryQuantity,
      available: status === "sold out" ? false : available,
      status,
      tags: productTags,
      collections: list(input.collections).slice(0, 100),
      productType: clean(input.productType || input.type || "General"),
      type: clean(input.productType || input.type || "General"),
      careLevel: clean(input.careLevel),
      indoorOutdoor: clean(input.indoorOutdoor),
      image: normalizedImage,
      images: gallery,
      imageAlt: clean(input.imageAlt || title),
      seoTitle: clean(input.seoTitle || title),
      seoDescription: clean(input.seoDescription || description),
      vendor: clean(input.vendor),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await productRef.set(productData);
    return NextResponse.json({ ok: true, product: productData });
  } catch (error) {
    return NextResponse.json({ error: String((error as Error).message || error) }, { status: 500 });
  }
}

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
