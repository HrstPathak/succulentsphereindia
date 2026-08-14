import "server-only";

import { FieldPath } from "firebase-admin/firestore";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { getReviewStats, type ProductReview } from "@/lib/reviews";

export interface ProductQueryOptions {
  first?: number;
  after?: string | null;
  sortKey?: "BEST_SELLING" | "CREATED_AT" | "PRICE" | "RELEVANCE" | "TITLE";
  reverse?: boolean;
  cache?: RequestCache;
  next?: { revalidate?: number; tags?: string[] };
}

export interface RecommendationProduct {
  id: string; title: string; handle: string; description: string; tags: string[]; category: string;
  careLevel: string; indoorOutdoor: string; price: string; compareAtPrice?: string | null; currency: string;
  image: string; imageAlt?: string; available: boolean; collections: string[];
}

export interface FirebaseArticle {
  id: string; handle: string; title: string; excerpt: string; seoDescription: string; authorName: string;
  contentHtml: string; publishedAt: string; image: { url: string; altText: string; width: number; height: number } | null;
  blogHandle: string; blogTitle: string;
}

export interface FirebaseCustomerOrder {
  id: string; orderNumber: number; processedAt: string; fulfillmentStatus: string; financialStatus: string;
  tags?: string[]; fulfillmentOrderStatuses?: string[]; tracking?: FirebaseOrderTrackingEntry[]; fulfillmentEvents?: string[];
  lineItems: FirebaseCustomerOrderLineItem[];
  currentSubtotalPrice?: Money; currentTotalShippingPrice?: Money; currentTotalTax?: Money; currentTotalPrice?: Money;
  totalPrice: Money;
}
export interface FirebaseOrderTrackingEntry { number: string; url: string; company: string; }
export interface FirebaseCustomerOrderLineItem {
  id: string; title: string; quantity: number; variantTitle: string; productHandle: string; image: string; imageAlt?: string;
  customAttributes?: { key: string; value: string }[]; originalTotalPrice?: Money; discountedTotalPrice?: Money; price: Money;
}
export interface FirebaseCustomerAddress {
  id: string; firstName: string; lastName: string; company: string; address1: string; address2: string; city: string;
  province: string; country: string; zip: string; phone: string;
}
export interface FirebaseAuthenticatedCustomer {
  id: string; firstName: string; lastName: string; displayName: string; email: string; phone: string | null;
  defaultAddressId: string | null; addresses: FirebaseCustomerAddress[]; orders: FirebaseCustomerOrder[];
}
export type Money = { amount: string; currencyCode: string };

const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;
const productCache = new Map<string, { expiresAt: number; value: unknown }>();

async function readThroughCache<T>(key: string, factory: () => Promise<T>, ttlMs = PRODUCT_CACHE_TTL_MS): Promise<T> {
  const now = Date.now();
  const cached = productCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const value = await factory();
  productCache.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}

function string(value: unknown, fallback = "") { return typeof value === "string" ? value : value == null ? fallback : String(value); }
function numeric(value: unknown, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function list(value: unknown): string[] { return Array.isArray(value) ? value.map((item) => string(item).trim()).filter(Boolean) : []; }
function cleanHtml(value: unknown) { return string(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
function normaliseHandle(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return string(raw).trim().replace(/^\/+|\/+$/g, "").split("/").pop()?.trim() || "";
}
function money(value: unknown, fallback = "0.00"): Money {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { amount: string(data.amount ?? fallback), currencyCode: string(data.currencyCode ?? "INR") };
}

function mapProduct(id: string, raw: Record<string, unknown>, reviews: ProductReview[] = []) {
  const images = Array.isArray(raw.images) ? raw.images : [];
  const firstImage = raw.image || images[0] || "/assets/product-1.jpg";
  const firstImageUrl = typeof firstImage === "object" && firstImage ? string((firstImage as Record<string, unknown>).url) : string(firstImage);
  const firstImageAlt = typeof firstImage === "object" && firstImage ? string((firstImage as Record<string, unknown>).altText) : string(raw.imageAlt);
  const stats = getReviewStats(reviews);
  const price = numeric(raw.price);
  const inventory = numeric(raw.inventoryQuantity ?? raw.quantity ?? raw.totalInventory, 0);
  return {
    ...raw,
    id,
    title: string(raw.title, "Untitled"), handle: string(raw.handle), description: string(raw.description),
    descriptionHtml: string(raw.descriptionHtml || raw.description), image: firstImageUrl || "/assets/product-1.jpg", imageAlt: firstImageAlt,
    images: images.length ? images.map((item) => typeof item === "object" && item ? string((item as Record<string, unknown>).url) : string(item)).filter(Boolean) : [firstImageUrl],
    imageAlts: images.length ? images.map((item) => typeof item === "object" && item ? string((item as Record<string, unknown>).altText) : "") : [firstImageAlt],
    price: price.toFixed(2), compareAtPrice: raw.compareAtPrice == null ? null : numeric(raw.compareAtPrice).toFixed(2),
    currency: string(raw.currency, "INR"), quantity: inventory, inventoryQuantity: inventory, totalInventory: inventory,
    available: raw.available !== false && inventory > 0, availability: raw.available === false || inventory <= 0 ? "OutOfStock" : "InStock",
    tags: list(raw.tags), collections: list(raw.collections), type: string(raw.type || raw.productType || "General"),
    productType: string(raw.productType || raw.type || "General"), careLevel: string(raw.careLevel), indoorOutdoor: string(raw.indoorOutdoor), createdAt: string(raw.createdAt),
    rating: stats.reviewCount ? stats.averageRating : numeric(raw.rating, 0) || undefined, reviewCount: stats.reviewCount || numeric(raw.reviewCount, 0),
    reviews, faqs: Array.isArray(raw.faqs) ? raw.faqs : [], seoTitle: string(raw.seoTitle), seoDescription: string(raw.seoDescription),
  };
}

async function getReviewsForProduct(productId: string): Promise<ProductReview[]> {
  const snapshot = await getFirebaseDb().collection("reviews").where("productId", "==", productId).where("status", "==", "published").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ProductReview)).sort((a, b) => string(b.createdAt).localeCompare(string(a.createdAt)));
}

async function allProducts() {
  return readThroughCache("catalog:all-products", async () => {
    const snapshot = await getFirebaseDb().collection("products").limit(1000).get();
    // Catalog and filter pages do not need every individual review document.
    // Fetching reviews once per product made a 119-item catalog request issue
    // hundreds of Firestore reads and delayed normal storefront pages.
    return snapshot.docs.map((doc) => mapProduct(doc.id, doc.data()));
  }, PRODUCT_CACHE_TTL_MS);
}

function sortProducts(items: any[], options: ProductQueryOptions) {
  const multiplier = options.reverse ? -1 : 1;
  const key = options.sortKey || "BEST_SELLING";
  return [...items].sort((a, b) => {
    let result = 0;
    if (key === "PRICE") result = numeric(a.price) - numeric(b.price);
    else if (key === "TITLE") result = string(a.title).localeCompare(string(b.title));
    else if (key === "CREATED_AT") result = string(a.createdAt).localeCompare(string(b.createdAt));
    else result = numeric(b.salesCount ?? b.reviewCount) - numeric(a.salesCount ?? a.reviewCount);
    return result * multiplier;
  });
}

function queryMatches(product: any, rawQuery: string) {
  const query = string(rawQuery).trim().toLowerCase();
  if (!query) return true;
  const tagMatches = [...query.matchAll(/tag:\"([^\"]+)\"/g)].map((match) => match[1].toLowerCase());
  const typeMatches = [...query.matchAll(/product_type:\"([^\"]+)\"/g)].map((match) => match[1].toLowerCase());
  if (tagMatches.length && !tagMatches.every((tag) => list(product.tags).some((item) => item.toLowerCase() === tag))) return false;
  if (typeMatches.length && !typeMatches.every((type) => string(product.productType || product.type).toLowerCase() === type)) return false;
  const terms = query.replace(/tag:\"[^\"]+\"|product_type:\"[^\"]+\"|[()]/g, " ").replace(/\b(and|or)\b/g, " ").replace(/\"/g, " ").split(/\s+/).filter((term) => term.length > 1);
  const searchable = [product.title, product.description, product.productType, ...list(product.tags), ...list(product.collections)].join(" ").toLowerCase();
  return !terms.length || terms.some((term) => searchable.includes(term));
}

export async function fetchProductsByQuery(searchQuery: string, options: ProductQueryOptions = {}) {
  const first = Math.max(1, Math.min(options.first || 24, 100));
  const products = sortProducts((await allProducts()).filter((product) => queryMatches(product, searchQuery)), options);
  return { edges: products.slice(0, first).map((node) => ({ node })), pageInfo: { hasNextPage: products.length > first, endCursor: null } };
}
export async function fetchProductsList(limit = 24, options: ProductQueryOptions = {}) { return sortProducts(await allProducts(), options).slice(0, limit); }
export async function fetchAllProductsList(options: ProductQueryOptions = {}) { return sortProducts(await allProducts(), options); }
export async function fetchProductByHandle(handleInput: unknown) {
  const handle = normaliseHandle(handleInput); if (!handle) return null;

  return readThroughCache(`catalog:product:${handle}`, async () => {
    const snapshot = await getFirebaseDb().collection("products").where("handle", "==", handle).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0]!;
    return mapProduct(doc.id, doc.data(), await getReviewsForProduct(doc.id));
  }, PRODUCT_CACHE_TTL_MS);
}
export async function fetchProductsByIds(ids: string[]) {
  const uniqueIds = [...new Set(ids.map((id) => string(id).trim()).filter(Boolean))].slice(0, 30);
  if (!uniqueIds.length) return [];
  const chunks: string[][] = []; for (let i = 0; i < uniqueIds.length; i += 30) chunks.push(uniqueIds.slice(i, i + 30));
  const snapshots = await Promise.all(chunks.map((chunk) => getFirebaseDb().collection("products").where(FieldPath.documentId(), "in", chunk).get()));
  const byId = new Map<string, any>();
  for (const doc of snapshots.flatMap((snapshot) => snapshot.docs)) byId.set(doc.id, mapProduct(doc.id, doc.data()));
  return uniqueIds.map((id) => byId.get(id)).filter(Boolean);
}
export async function fetchRecommendationCandidates(handleInput: unknown, maxCandidates = 30) {
  const current = await fetchProductByHandle(handleInput); if (!current) return { current: null, candidates: [] as RecommendationProduct[] };
  const candidates = (await allProducts()).filter((item) => item.id !== current.id).map((item) => ({ item, score: (item.productType === current.productType ? 20 : 0) + item.tags.filter((tag: string) => current.tags.includes(tag)).length * 5 + (item.available ? 5 : 0) })).sort((a, b) => b.score - a.score).slice(0, maxCandidates).map(({ item }) => ({ id: item.id, title: item.title, handle: item.handle, description: item.description, tags: item.tags, category: item.productType, careLevel: string(item.careLevel), indoorOutdoor: string(item.indoorOutdoor), price: item.price, compareAtPrice: item.compareAtPrice, currency: item.currency, image: item.image, imageAlt: item.imageAlt, available: item.available, collections: item.collections }));
  return { current: { id: current.id, title: current.title, handle: current.handle, description: current.description, tags: current.tags, category: current.productType, careLevel: string(current.careLevel), indoorOutdoor: string(current.indoorOutdoor), price: current.price, compareAtPrice: current.compareAtPrice, currency: current.currency, image: current.image, imageAlt: current.imageAlt, available: current.available, collections: current.collections }, candidates };
}

function mapArticle(id: string, data: Record<string, unknown>): FirebaseArticle {
  const image = data.image && typeof data.image === "object" ? data.image as Record<string, unknown> : null;
  return { id, handle: string(data.handle), title: string(data.title), excerpt: string(data.excerpt) || cleanHtml(data.contentHtml).slice(0, 160), seoDescription: string(data.seoDescription) || cleanHtml(data.contentHtml).slice(0, 220), authorName: string(data.authorName, "Succulent Sphere Editorial Team"), contentHtml: string(data.contentHtml), publishedAt: string(data.publishedAt), image: image ? { url: string(image.url), altText: string(image.altText, string(data.title)), width: numeric(image.width, 1600), height: numeric(image.height, 900) } : null, blogHandle: string(data.blogHandle, "plant-care"), blogTitle: string(data.blogTitle, "Plant Care") };
}
export async function fetchPlantCareArticles(limit = 24): Promise<FirebaseArticle[]> { const snapshot = await getFirebaseDb().collection("articles").orderBy("publishedAt", "desc").limit(limit).get(); return snapshot.docs.map((doc) => mapArticle(doc.id, doc.data())); }
export async function fetchPlantCareArticleByHandle(handleInput: unknown): Promise<FirebaseArticle | null> { const handle = normaliseHandle(handleInput); const snapshot = await getFirebaseDb().collection("articles").where("handle", "==", handle).limit(1).get(); return snapshot.empty ? null : mapArticle(snapshot.docs[0]!.id, snapshot.docs[0]!.data()); }

function mapOrder(id: string, raw: Record<string, any>): FirebaseCustomerOrder {
  const lineItems = Array.isArray(raw.lineItems) ? raw.lineItems : [];
  return { id, orderNumber: numeric(raw.orderNumber), processedAt: string(raw.processedAt || raw.createdAt), fulfillmentStatus: string(raw.fulfillmentStatus, "UNFULFILLED"), financialStatus: string(raw.financialStatus, "PENDING"), tags: list(raw.tags), fulfillmentOrderStatuses: list(raw.fulfillmentOrderStatuses), tracking: Array.isArray(raw.tracking) ? raw.tracking.map((x: any) => ({ number: string(x.number), url: string(x.url), company: string(x.company) })) : [], fulfillmentEvents: list(raw.fulfillmentEvents), lineItems: lineItems.map((item: any, index: number) => ({ id: string(item.id, `${id}-${index}`), title: string(item.title), quantity: numeric(item.quantity, 1), variantTitle: string(item.variantTitle), productHandle: string(item.productHandle), image: string(item.image), imageAlt: string(item.imageAlt), customAttributes: Array.isArray(item.customAttributes) ? item.customAttributes : [], originalTotalPrice: item.originalTotalPrice ? money(item.originalTotalPrice) : undefined, discountedTotalPrice: item.discountedTotalPrice ? money(item.discountedTotalPrice) : undefined, price: money(item.price ?? { amount: item.unitPrice, currencyCode: raw.currency || "INR" }) })), currentSubtotalPrice: raw.currentSubtotalPrice ? money(raw.currentSubtotalPrice) : money({ amount: raw.subtotal, currencyCode: raw.currency || "INR" }), currentTotalShippingPrice: raw.currentTotalShippingPrice ? money(raw.currentTotalShippingPrice) : money({ amount: raw.shipping, currencyCode: raw.currency || "INR" }), currentTotalTax: raw.currentTotalTax ? money(raw.currentTotalTax) : undefined, currentTotalPrice: raw.currentTotalPrice ? money(raw.currentTotalPrice) : money({ amount: raw.total, currencyCode: raw.currency || "INR" }), totalPrice: money(raw.totalPrice ?? { amount: raw.total, currencyCode: raw.currency || "INR" }) };
}
export async function fetchOrderByEmailAndNumber(email: string, orderNumber: string) { const snapshot = await getFirebaseDb().collection("orders").where("emailLower", "==", email.toLowerCase()).where("orderNumber", "==", Number(orderNumber.replace(/^#/, ""))).limit(1).get(); return snapshot.empty ? null : mapOrder(snapshot.docs[0]!.id, snapshot.docs[0]!.data()); }
export async function fetchCustomerOrdersByUid(uid: string) {
  const snapshot = await getFirebaseDb().collection("orders").where("userId", "==", uid).get();
  return snapshot.docs
    .map((doc) => mapOrder(doc.id, doc.data()))
    .sort((a, b) => b.processedAt.localeCompare(a.processedAt));
}
export async function fetchCustomerByUid(uid: string): Promise<FirebaseAuthenticatedCustomer | null> {
  const db = getFirebaseDb(); const userDoc = await db.collection("users").doc(uid).get(); if (!userDoc.exists) return null;
  const data = userDoc.data() || {}; const addressesSnapshot = await userDoc.ref.collection("addresses").get(); const orders = await fetchCustomerOrdersByUid(uid);
  return { id: uid, firstName: string(data.firstName), lastName: string(data.lastName), displayName: string(data.displayName), email: string(data.email), phone: data.phone ? string(data.phone) : null, defaultAddressId: data.defaultAddressId ? string(data.defaultAddressId) : null, addresses: addressesSnapshot.docs.map((doc) => ({ id: doc.id, firstName: string(doc.get("firstName")), lastName: string(doc.get("lastName")), company: string(doc.get("company")), address1: string(doc.get("address1")), address2: string(doc.get("address2")), city: string(doc.get("city")), province: string(doc.get("province")), country: string(doc.get("country")), zip: string(doc.get("zip")), phone: string(doc.get("phone")) })), orders };
}
export async function updateUserProfile(uid: string, input: { firstName: string; lastName: string; phone?: string }) { await getFirebaseDb().collection("users").doc(uid).set({ ...input, displayName: `${input.firstName} ${input.lastName}`.trim(), updatedAt: new Date().toISOString() }, { merge: true }); }
export async function createAddress(uid: string, address: Omit<FirebaseCustomerAddress, "id">) { const ref = await getFirebaseDb().collection("users").doc(uid).collection("addresses").add({ ...address, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); const userRef = getFirebaseDb().collection("users").doc(uid); const user = await userRef.get(); if (!user.get("defaultAddressId")) await userRef.set({ defaultAddressId: ref.id }, { merge: true }); return ref.id; }
export async function updateAddress(uid: string, addressId: string, address: Partial<Omit<FirebaseCustomerAddress, "id">>) { await getFirebaseDb().collection("users").doc(uid).collection("addresses").doc(addressId).set({ ...address, updatedAt: new Date().toISOString() }, { merge: true }); }
export async function deleteAddress(uid: string, addressId: string) { const db = getFirebaseDb(); await db.collection("users").doc(uid).collection("addresses").doc(addressId).delete(); const userRef = db.collection("users").doc(uid); const user = await userRef.get(); if (user.get("defaultAddressId") === addressId) { const first = await userRef.collection("addresses").limit(1).get(); await userRef.set({ defaultAddressId: first.docs[0]?.id || null }, { merge: true }); } }
export async function setDefaultAddress(uid: string, addressId: string) { const ref = getFirebaseDb().collection("users").doc(uid).collection("addresses").doc(addressId); if (!(await ref.get()).exists) throw new Error("Address not found."); await ref.parent.parent!.set({ defaultAddressId: addressId }, { merge: true }); }
