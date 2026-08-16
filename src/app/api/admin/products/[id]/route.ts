import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

const text = (value: unknown, fallback = "") => typeof value === "string" ? value.trim() : value == null ? fallback : String(value).trim();
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const list = (value: unknown) => Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
const statuses = new Set(["active", "draft", "archived", "unlisted", "sold out"]);

function productPayload(id: string, data: Record<string, unknown>) {
  const images = Array.from(new Set([...(Array.isArray(data.images) ? data.images : []), text(data.image)] .map((entry) => text(entry)).filter(Boolean)));
  return {
    id,
    title: text(data.title), handle: text(data.handle), description: text(data.description),
    price: number(data.price), compareAtPrice: data.compareAtPrice == null || data.compareAtPrice === "" ? null : number(data.compareAtPrice),
    currency: text(data.currency, "INR"), inventoryQuantity: Math.max(0, Math.floor(number(data.inventoryQuantity))),
    available: data.available !== false, status: text(data.status, "active"), tags: list(data.tags), collections: list(data.collections),
    productType: text(data.productType || data.type), careLevel: text(data.careLevel), indoorOutdoor: text(data.indoorOutdoor),
    image: text(data.image), images, imageAlt: text(data.imageAlt), seoTitle: text(data.seoTitle), seoDescription: text(data.seoDescription),
    vendor: text(data.vendor), updatedAt: text(data.updatedAt), createdAt: text(data.createdAt),
  };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const db = getFirebaseDb();
    const product = await db.collection("products").doc(text(id)).get();
    if (!product.exists) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const reviews = await db.collection("reviews").where("productId", "==", product.id).get();
    return NextResponse.json({
      product: productPayload(product.id, product.data() || {}),
      reviews: reviews.docs.map((review) => {
        const data = review.data();
        return { id: review.id, authorName: text(data.authorName, "Customer"), authorEmail: text(data.authorEmail), title: text(data.title), content: text(data.content), rating: Math.max(1, Math.min(5, Math.round(number(data.rating, 1)))), status: text(data.status, "published"), verifiedPurchase: Boolean(data.verifiedPurchase), createdAt: text(data.createdAt), orderNumber: text(data.orderNumber) };
      }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  } catch (error) {
    return NextResponse.json({ error: text((error as Error).message, "Unable to load product.") }, { status: text((error as Error).message) === "ADMIN_REQUIRED" ? 404 : 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";
    let input: Record<string, any> = {};
    let uploadedImages: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      input = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, typeof value === "string" ? value : value.name]));
      const extraFiles = form.getAll("imageFiles").filter((value): value is File => value instanceof File && value.size > 0);
      uploadedImages = (await Promise.all(extraFiles.map(async (file) => {
        const endpoint = String(process.env.HOSTINGER_UPLOAD_URL || "").trim();
        const token = String(process.env.HOSTINGER_UPLOAD_TOKEN || "").trim();
        if (!endpoint) return "";
        const formData = new FormData();
        formData.append("file", file, file.name || "product-image");
        if (token) formData.append("token", token);
        const dir = String(process.env.HOSTINGER_UPLOAD_DIR || "sites/images").trim();
        if (dir) formData.append("path", dir);
        const response = await fetch(endpoint, { method: "POST", body: formData, cache: "no-store" });
        const rawText = await response.text();
        let payload: any = null;
        try { payload = rawText ? JSON.parse(rawText) : null; } catch {}
        const directUrl = String(payload?.url || payload?.imageUrl || payload?.data?.url || payload?.path || "").trim();
        if (response.ok && directUrl) return directUrl.startsWith("http") ? directUrl : `${String(process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://whitesmoke-cattle-754161.hostingersite.com").replace(/\/+$/, "")}/${directUrl.replace(/^\/+/, "")}`;
        if (response.ok && typeof payload?.filename === "string") {
          const base = String(process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://whitesmoke-cattle-754161.hostingersite.com").replace(/\/+$/, "");
          return `${base}/${dir.replace(/^\/+/, "")}/${payload.filename.replace(/^\/+/, "")}`;
        }
        return "";
      }))).filter(Boolean);
      const images = [...new Set([...(Array.isArray(input.images) ? input.images : []), ...text(input.images || "").split(",").map((entry) => entry.trim()).filter(Boolean), ...uploadedImages, text(input.image)])].filter(Boolean);
      input.images = images;
    } else {
      input = await request.json();
    }

    const title = text(input.title).slice(0, 250);
    const handle = text(input.handle).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 250);
    const price = number(input.price, -1);
    const inventoryQuantity = number(input.inventoryQuantity, -1);
    const status = text(input.status, "active").toLowerCase();
    if (!title || !handle || price < 0 || inventoryQuantity < 0 || !statuses.has(status)) {
      return NextResponse.json({ error: "Title, handle, price, inventory, and a valid product status are required." }, { status: 400 });
    }
    const compareAtPrice = input.compareAtPrice === "" || input.compareAtPrice == null ? null : number(input.compareAtPrice, -1);
    if (compareAtPrice !== null && compareAtPrice < 0) return NextResponse.json({ error: "Compare-at price must be a valid amount." }, { status: 400 });

    // Only update images if they were explicitly provided in the request
    const images = [...new Set([...(Array.isArray(input.images) ? input.images : []), ...text(input.images || "").split(",").map((entry) => entry.trim()).filter(Boolean), text(input.image)].filter(Boolean))];
    const primaryImage = images[0] || text(input.image);

    const update: any = {
      title, handle, price, compareAtPrice, inventoryQuantity: Math.floor(inventoryQuantity), status,
      available: Boolean(input.available), description: text(input.description).slice(0, 30000),
      tags: list(input.tags).slice(0, 100), collections: list(input.collections).slice(0, 100),
      productType: text(input.productType).slice(0, 160), type: text(input.productType).slice(0, 160),
      careLevel: text(input.careLevel).slice(0, 120), indoorOutdoor: text(input.indoorOutdoor).slice(0, 120),
      seoTitle: text(input.seoTitle).slice(0, 250), seoDescription: text(input.seoDescription).slice(0, 500),
      vendor: text(input.vendor).slice(0, 160), updatedAt: new Date().toISOString(),
    };
    
    // Only include image fields if new images were provided (don't overwrite with empty values)
    if (images.length > 0 || uploadedImages.length > 0 || text(input.image) || text(input.imageAlt)) {
      update.image = primaryImage.slice(0, 2000);
      update.images = images.slice(0, 20);
      update.imageAlt = text(input.imageAlt).slice(0, 500);
    }
    const ref = getFirebaseDb().collection("products").doc(text(id));
    if (!(await ref.get()).exists) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    await ref.set(update, { merge: true });
    return NextResponse.json({ ok: true, product: productPayload(text(id), update) });
  } catch (error) {
    return NextResponse.json({ error: text((error as Error).message, "Unable to save product.") }, { status: text((error as Error).message) === "ADMIN_REQUIRED" ? 404 : 500 });
  }
}
