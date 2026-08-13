import { resolveProductImageAlt } from "@/lib/imageAlt";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { parseProductFaqs } from "@/lib/product-faqs";
import { getReviewStats, parseProductReviews } from "@/lib/reviews";

async function getShopifyAdminAccessToken() {
  return String(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || "").trim();
}

function normalizeStoreDomain(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .split("/")[0] || "";
}

function getShopifyConfig() {
  const domain = normalizeStoreDomain(process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_URL || "");
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN || process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || "";
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-01";

  if (!domain || !token) {
    throw new Error("Missing Shopify configuration. Required: SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN.");
  }

  return { domain, token, apiVersion };
}

async function getShopifyAdminConfig() {
  const domain = normalizeStoreDomain(process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_URL || "");
  const token = await getShopifyAdminAccessToken();
  const apiVersion = process.env.SHOPIFY_ADMIN_API_VERSION || process.env.SHOPIFY_API_VERSION || "2026-01";

  if (!domain || !token) {
    throw new Error("Missing Shopify admin configuration. Required: SHOPIFY_STORE_DOMAIN and admin credentials.");
  }
  // console.log("[getShopifyAdminConfig] domain:", domain, "apiVersion:", apiVersion, "token length:", token);
  return { domain, token, apiVersion };
}

type ShopifyFetchOptions = {
  cache?: RequestCache;
  next?: { revalidate?: number; tags?: string[] };
};
export async function updateCustomerWishlistMetafieldByAccessToken(
  accessToken: string,
  value: string
) {
  void accessToken;
  void value;
  return {
    success: false,
    userErrors: [
      "Storefront API cannot update customer metafields for this schema version. Use Admin API metafieldsSet with customer scopes.",
    ],
  };
}
export async function shopifyFetch(
  query: string,
  variables: Record<string, any> = {},
  options: ShopifyFetchOptions = {}
) {
  const { domain, token, apiVersion } = getShopifyConfig();
  const requestInit: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: options.cache ?? "no-store",
  };

  if (options.next) {
    requestInit.next = options.next;
  }

  const response = await fetch(`https://${domain}/api/${apiVersion}/graphql.json`, {
    ...requestInit,
  });

  const json = await response.json();
  if (!response.ok) {
    const msg = json?.errors ? JSON.stringify(json.errors) : response.statusText;
    throw new Error(`[shopifyFetch] ${msg}`);
  }
  return json;
}

export async function shopifyAdminFetch(
  query: string,
  variables: Record<string, any> = {}
) {
  const { domain, token, apiVersion } = await getShopifyAdminConfig();

  const response = await fetch(`https://${domain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();
  let json: any = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = null;
  }

  if (!json) {
    const snippet = rawText ? rawText.slice(0, 220) : "";
    const hint = domain.includes("myshopify.com")
      ? "Shopify Admin API returned a non-JSON response."
      : "Check SHOPIFY_STORE_DOMAIN. Admin API must use your-store.myshopify.com.";
    throw new Error(
      `[shopifyAdminFetch] Non-JSON response (${response.status}) ${contentType || "unknown content-type"}. ${hint} Snippet: ${snippet}`
    );
  }
  if (!response.ok) {
    const msg = json?.errors ? JSON.stringify(json.errors) : response.statusText;
    throw new Error(`[shopifyAdminFetch] ${msg}`);
  }
  return json;
}

export async function adminUpdateCustomerNameByEmail(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}): Promise<{ updated: boolean; userErrors: string[] }> {
  const email = String(input.email || "").trim().toLowerCase();
  const firstName = String(input.firstName || "").trim();
  const lastName = String(input.lastName || "").trim();
  const phone = String(input.phone || "").trim();
  if (!email || (!firstName && !lastName && !phone)) return { updated: false, userErrors: [] };

  const lookupQuery = `query FindCustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          id
        }
      }
    }
  }`;
  const lookup = await shopifyAdminFetch(lookupQuery, { query: `email:${email}` });
  const customerId = lookup?.data?.customers?.edges?.[0]?.node?.id ? String(lookup.data.customers.edges[0].node.id) : "";
  if (!customerId) {
    return { updated: false, userErrors: ["Customer not found for this email."] };
  }

  const mutation = `mutation CustomerUpdateName($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer { id }
      userErrors { message }
    }
  }`;
  const updated = await shopifyAdminFetch(mutation, {
    input: {
      id: customerId,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(phone ? { phone } : {}),
    },
  });

  const userErrors = Array.isArray(updated?.data?.customerUpdate?.userErrors)
    ? updated.data.customerUpdate.userErrors.map((error: any) => String(error?.message || "").trim()).filter(Boolean)
    : [];

  return { updated: userErrors.length === 0, userErrors };
}

export async function adminSubscribeEmailByAddress(input: {
  email: string;
}): Promise<{ subscribed: boolean; created: boolean; alreadySubscribed: boolean; userErrors: string[] }> {
  const email = String(input.email || "").trim().toLowerCase();
  if (!email) return { subscribed: false, created: false, alreadySubscribed: false, userErrors: ["Email is required."] };

  const consent = {
    marketingState: "SUBSCRIBED",
    marketingOptInLevel: "SINGLE_OPT_IN",
    consentUpdatedAt: new Date().toISOString(),
  };

  const lookupQuery = `query FindCustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      edges {
        node {
          id
          email
          emailMarketingConsent {
            marketingState
          }
        }
      }
    }
  }`;

  const lookup = await shopifyAdminFetch(lookupQuery, { query: `email:${email}` });
  const customerId = lookup?.data?.customers?.edges?.[0]?.node?.id
    ? String(lookup.data.customers.edges[0].node.id)
    : "";
  const currentMarketingState = String(
    lookup?.data?.customers?.edges?.[0]?.node?.emailMarketingConsent?.marketingState || ""
  ).toUpperCase();

  if (customerId) {
    if (currentMarketingState === "SUBSCRIBED") {
      return { subscribed: true, created: false, alreadySubscribed: true, userErrors: [] };
    }

    const updateMutation = `mutation CustomerSubscribe($input: CustomerEmailMarketingConsentUpdateInput!) {
      customerEmailMarketingConsentUpdate(input: $input) {
        customer { id }
        userErrors { message }
      }
    }`;
    const updated = await shopifyAdminFetch(updateMutation, {
      input: {
        customerId,
        emailMarketingConsent: consent,
      },
    });

    const userErrors = Array.isArray(updated?.data?.customerEmailMarketingConsentUpdate?.userErrors)
      ? updated.data.customerEmailMarketingConsentUpdate.userErrors
          .map((error: any) => String(error?.message || "").trim())
          .filter(Boolean)
      : [];

    return { subscribed: userErrors.length === 0, created: false, alreadySubscribed: false, userErrors };
  }

  const createMutation = `mutation CustomerCreateSubscriber($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id }
      userErrors { message }
    }
  }`;

  const created = await shopifyAdminFetch(createMutation, {
    input: {
      email,
      emailMarketingConsent: consent,
    },
  });

  const userErrors = Array.isArray(created?.data?.customerCreate?.userErrors)
    ? created.data.customerCreate.userErrors.map((error: any) => String(error?.message || "").trim()).filter(Boolean)
    : [];

  return { subscribed: userErrors.length === 0, created: true, alreadySubscribed: false, userErrors };
}

let adminCustomerScopeCache:
  | { checkedAt: number; result: { ok: boolean; scopes: string[]; userErrors: string[] } }
  | null = null;

export async function checkAdminCustomerWriteScopes(): Promise<{
  ok: boolean;
  scopes: string[];
  userErrors: string[];
}> {
  const now = Date.now();
  const maxAgeMs = 5 * 60 * 1000;
  if (adminCustomerScopeCache && now - adminCustomerScopeCache.checkedAt < maxAgeMs) {
    return adminCustomerScopeCache.result;
  }

  const query = `query AdminAccessScopes {
    currentAppInstallation {
      accessScopes {
        handle
      }
    }
  }`;

  const response = await shopifyAdminFetch(query, {});
  const topLevelErrors = Array.isArray(response?.errors)
    ? response.errors
        .map((error: { message?: string }) => String(error?.message || "Unable to verify admin scopes."))
        .filter(Boolean)
    : [];

  if (topLevelErrors.length > 0) {
    const result = { ok: false, scopes: [], userErrors: topLevelErrors };
    adminCustomerScopeCache = { checkedAt: now, result };
    return result;
  }

  const scopes = Array.isArray(response?.data?.currentAppInstallation?.accessScopes)
    ? response.data.currentAppInstallation.accessScopes
        .map((scope: { handle?: string }) => String(scope?.handle || "").trim())
        .filter(Boolean)
    : [];

  const hasWriteCustomers = scopes.includes("write_customers");
  const userErrors = hasWriteCustomers
    ? []
    : [
        "Admin API scope missing: write_customers. Reauthorize the app and refresh SHOPIFY_ADMIN_ACCESS_TOKEN to use metafieldsSet for customer owner IDs.",
      ];

  const result = { ok: hasWriteCustomers, scopes, userErrors };
  adminCustomerScopeCache = { checkedAt: now, result };
  return result;
}

export interface ProductQueryOptions {
  first?: number;
  after?: string | null;
  sortKey?: "BEST_SELLING" | "CREATED_AT" | "PRICE" | "RELEVANCE" | "TITLE";
  reverse?: boolean;
  cache?: RequestCache;
  next?: { revalidate?: number; tags?: string[] };
}

const PRODUCT_FAQS_NAMESPACE = process.env.SHOPIFY_PRODUCT_FAQS_NAMESPACE || "custom";
const PRODUCT_FAQS_KEY = process.env.SHOPIFY_PRODUCT_FAQS_KEY || "product_faqs";
const PRODUCT_FAQS_FALLBACK_KEY = process.env.SHOPIFY_PRODUCT_FAQS_FALLBACK_KEY || "faqs";

export interface RecommendationProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  tags: string[];
  category: string;
  careLevel: string;
  indoorOutdoor: string;
  price: string;
  compareAtPrice?: string | null;
  currency: string;
  image: string;
  imageAlt?: string;
  available: boolean;
  collections: string[];
}

function parseProductRating(value: unknown, fallback = 4.6): number {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  // Shopify "rating" metafield can come as JSON text with { value, scale_min, scale_max }.
  try {
    const parsedJson = JSON.parse(raw);
    if (parsedJson && typeof parsedJson === "object" && "value" in parsedJson) {
      const numericValue = Number((parsedJson as { value?: unknown }).value);
      if (Number.isFinite(numericValue)) return Math.max(0, Math.min(5, numericValue));
    }
  } catch {}

  // Handle human-readable values such as "4.4 out of 5.0".
  const outOfMatch = raw.match(/(\d+(\.\d+)?)\s*out of\s*(\d+(\.\d+)?)/i);
  if (outOfMatch) {
    const numericValue = Number(outOfMatch[1]);
    const scaleMax = Number(outOfMatch[3]);
    if (Number.isFinite(numericValue) && Number.isFinite(scaleMax) && scaleMax > 0) {
      const normalized = (numericValue / scaleMax) * 5;
      return Math.max(0, Math.min(5, normalized));
    }
  }

  const firstNumber = raw.match(/\d+(\.\d+)?/);
  if (!firstNumber) return fallback;
  const parsed = Number(firstNumber[0]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(5, parsed));
}

function cleanRecommendationText(input: unknown, maxLen = 360): string {
  return String(input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function toRecommendationProduct(node: any): RecommendationProduct {
  const descriptionText =
    cleanRecommendationText(node?.description) ||
    cleanRecommendationText(node?.descriptionHtml) ||
    cleanRecommendationText(node?.title, 120);

  const image =
    normalizeImageUrl(node?.images?.edges?.[0]?.node?.url, "") ||
    node?.image ||
    "/assets/product-1.jpg";
  const imageAlt =
    resolveProductImageAlt(node?.images?.edges?.[0]?.node?.altText);
  const variant = node?.variants?.edges?.[0]?.node;
  const price = variant?.price?.amount ?? variant?.priceV2?.amount ?? node?.price ?? "0.00";
  const currency = variant?.price?.currencyCode ?? variant?.priceV2?.currencyCode ?? node?.currency ?? "USD";
  const compareAtPrice = variant?.compareAtPrice?.amount ?? variant?.compareAtPriceV2?.amount ?? null;

  return {
    id: String(node?.id || ""),
    title: String(node?.title || "Untitled"),
    handle: String(node?.handle || ""),
    description: descriptionText,
    tags: Array.isArray(node?.tags) ? node.tags.map((tag: unknown) => String(tag)) : [],
    category: String(node?.productType || node?.type || "General"),
    careLevel: cleanRecommendationText(node?.careLevelMetafield?.value || node?.metafield?.value || "", 80) || "medium",
    indoorOutdoor:
      cleanRecommendationText(node?.indoorOutdoorMetafield?.value || "", 80) ||
      "indoor",
    price: String(price),
    compareAtPrice: compareAtPrice ? String(compareAtPrice) : null,
    currency: String(currency),
    image: normalizeImageUrl(image),
    imageAlt,
    available: Boolean(node?.availableForSale ?? node?.available ?? true),
    collections: Array.isArray(node?.collections?.edges)
      ? node.collections.edges
          .map((edge: any) => String(edge?.node?.handle || ""))
          .filter(Boolean)
      : [],
  };
}

function uniqueByHandle(items: RecommendationProduct[]): RecommendationProduct[] {
  const seen = new Set<string>();
  const out: RecommendationProduct[] = [];
  for (const item of items) {
    if (!item.handle || seen.has(item.handle)) continue;
    seen.add(item.handle);
    out.push(item);
  }
  return out;
}

function parsePrice(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function overlapCount(left: string[], right: string[]): number {
  const rightSet = new Set(right.map((item) => item.toLowerCase()));
  let count = 0;
  for (const item of left) {
    if (rightSet.has(item.toLowerCase())) count += 1;
  }
  return count;
}

function scoreRecommendationCandidate(current: RecommendationProduct, candidate: RecommendationProduct): number {
  const currentPrice = parsePrice(current.price);
  const candidatePrice = parsePrice(candidate.price);
  const priceDelta = currentPrice > 0 ? Math.abs(candidatePrice - currentPrice) / currentPrice : 1;

  let score = 0;
  if (candidate.category.toLowerCase() === current.category.toLowerCase()) score += 35;
  if (candidate.careLevel.toLowerCase() === current.careLevel.toLowerCase()) score += 20;
  if (candidate.indoorOutdoor.toLowerCase() === current.indoorOutdoor.toLowerCase()) score += 12;
  score += Math.min(18, overlapCount(candidate.tags, current.tags) * 6);
  score += Math.max(0, 15 - Math.round(priceDelta * 30));
  if (candidate.available) score += 8;

  return score;
}

function buildRecommendationQuery(current: RecommendationProduct): string {
  const parts: string[] = [];
  if (current.category) {
    parts.push(`product_type:"${current.category.replace(/"/g, '\\"')}"`);
  }
  const tags = current.tags.slice(0, 4).map((tag) => tag.trim()).filter(Boolean);
  if (tags.length > 0) {
    parts.push(`(${tags.map((tag) => `tag:"${tag.replace(/"/g, '\\"')}"`).join(" OR ")})`);
  }
  if (parts.length === 0 && current.title) {
    parts.push(current.title);
  }
  return parts.join(" AND ");
}

async function fetchCollectionProducts(handles: string[], first = 10): Promise<RecommendationProduct[]> {
  if (!handles.length) return [];
  const compact = handles.slice(0, 2);
  const gql = `query RecommendationCollection($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      handle
      products(first: $first, sortKey: BEST_SELLING) {
        edges {
          node {
            id
            title
            handle
            description
            productType
            tags
            availableForSale
            careLevelMetafield: metafield(namespace: "custom", key: "care_level") { value }
            indoorOutdoorMetafield: metafield(namespace: "custom", key: "indoor_outdoor") { value }
            images(first: 1) { edges { node { url altText } } }
            variants(first: 1) { edges { node { price { amount currencyCode } compareAtPrice { amount currencyCode } } } }
            collections(first: 3) { edges { node { handle } } }
          }
        }
      }
    }
  }`;

  const chunks = await Promise.all(
    compact.map(async (handle) => {
      const res = await shopifyFetch(gql, { handle, first });
      if (res.errors) {
        throw new Error(res.errors.map((e: any) => e.message).join(", "));
      }
      return (res.data?.collection?.products?.edges || []).map((edge: any) => toRecommendationProduct(edge?.node));
    })
  );

  return chunks.flat();
}

export async function fetchRecommendationCandidates(handleInput: unknown, maxCandidates = 30): Promise<{
  current: RecommendationProduct | null;
  candidates: RecommendationProduct[];
}> {
  const handle = normalizeHandle(handleInput);
  if (!handle) return { current: null, candidates: [] };

  const gql = `query RecommendationContext($handle: String!, $first: Int!, $q: String!) {
    current: productByHandle(handle: $handle) {
      id
      title
      handle
      description
      productType
      tags
      availableForSale
      careLevelMetafield: metafield(namespace: "custom", key: "care_level") { value }
      indoorOutdoorMetafield: metafield(namespace: "custom", key: "indoor_outdoor") { value }
      images(first: 1) { edges { node { url altText } } }
      availableForSale
      variants(first: 1) { edges { node { price { amount currencyCode } compareAtPrice { amount currencyCode } quantityAvailable } } }
      collections(first: 4) { edges { node { handle } } }
    }
    related: products(first: $first, query: $q, sortKey: BEST_SELLING) {
      edges {
        node {
          id
          title
          handle
          description
          productType
          tags
          availableForSale
          careLevelMetafield: metafield(namespace: "custom", key: "care_level") { value }
          indoorOutdoorMetafield: metafield(namespace: "custom", key: "indoor_outdoor") { value }
          images(first: 1) { edges { node { url altText } } }
          variants(first: 1) { edges { node { price { amount currencyCode } compareAtPrice { amount currencyCode } quantityAvailable } } }
          collections(first: 3) { edges { node { handle } } }
        }
      }
    }
  }`;

  const initialRes = await shopifyFetch(gql, { handle, first: 30, q: handle });
  if (initialRes.errors) {
    throw new Error(initialRes.errors.map((e: any) => e.message).join(", "));
  }

  const currentNode = initialRes.data?.current;
  if (!currentNode) return { current: null, candidates: [] };

  const current = toRecommendationProduct(currentNode);
  const smartQuery = buildRecommendationQuery(current);
  const relatedRes = await shopifyFetch(gql, { handle, first: 30, q: smartQuery || handle });
  if (relatedRes.errors) {
    throw new Error(relatedRes.errors.map((e: any) => e.message).join(", "));
  }

  const related = (relatedRes.data?.related?.edges || []).map((edge: any) => toRecommendationProduct(edge?.node));
  const collectionHandles = current.collections.slice(0, 2);

  let collectionRelated: RecommendationProduct[] = [];
  try {
    collectionRelated = await fetchCollectionProducts(collectionHandles, 12);
  } catch {}

  const merged = uniqueByHandle([...related, ...collectionRelated])
    .filter((candidate) => candidate.handle && candidate.handle !== current.handle)
    .map((candidate) => ({ candidate, score: scoreRecommendationCandidate(current, candidate) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates)
    .map((entry) => entry.candidate);

  return { current, candidates: merged };
}

export async function fetchProductsByQuery(searchQuery: string, options: ProductQueryOptions = {}) {
  const first = options.first ?? 6;
  const after = options.after ?? null;
  const sortKey = options.sortKey ?? "BEST_SELLING";
  const reverse = options.reverse ?? false;

  const gql = `query ($q: String!, $first: Int!, $after: String, $sortKey: ProductSortKeys, $reverse: Boolean!) {
    products(query: $q, first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
      edges {
        node {
          id
          title
          productType
          handle
          availableForSale
          tags
          createdAt
          metafield(namespace: "custom", key: "care_level") {
            value
          }
          ratingMetafield: metafield(namespace: "custom", key: "rating") {
            value
          }
          reviewsMetafield: metafield(namespace: "custom", key: "reviews") {
            value
          }
          images(first: 1) {
            edges { node { url altText } }
          }
          variants(first: 1) {
            edges { node { price { amount currencyCode } compareAtPrice { amount currencyCode } quantityAvailable } }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }`;

  const res = await shopifyFetch(
    gql,
    { q: searchQuery, first, after, sortKey, reverse },
    { cache: options.cache, next: options.next }
  );
  if (res.errors) {
    throw new Error(res.errors.map((e: any) => e.message).join(", "));
  }
  return res.data?.products ?? { edges: [] };
}

export async function fetchProductsList(limit = 24, options: ProductQueryOptions = {}) {
  const first = limit;
  const after = options.after ?? null;
  const sortKey = options.sortKey ?? "BEST_SELLING";
  const reverse = options.reverse ?? false;
  const gql = `query Products($first: Int!, $after: String, $sortKey: ProductSortKeys, $reverse: Boolean!) {
    products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
      edges {
        node {
          id
          title
          productType
          handle
          availableForSale
          metafield(namespace: "custom", key: "care_level") { value }
          ratingMetafield: metafield(namespace: "custom", key: "rating") { value }
          reviewsMetafield: metafield(namespace: "custom", key: "reviews") { value }
          plantGenusMetafield: metafield(namespace: "custom", key: "plant_genus") { value }
          potSizeMetafield: metafield(namespace: "custom", key: "pot_size") { value }
          potMaterialMetafield: metafield(namespace: "custom", key: "pot_material") { value }
          description
          images(first: 1) { edges { node { url altText } } }
          variants(first: 1) { edges { node { price { amount currencyCode } compareAtPrice { amount currencyCode } } } }
          collections(first: 8) { edges { node { handle } } }
          tags
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }`;

  const res = await shopifyFetch(gql, { first, after, sortKey, reverse });
  if (res.errors) {
    throw new Error(res.errors.map((e: any) => e.message).join(", "));
  }

  const edges = res.data?.products?.edges ?? [];
  return edges.map((e: any, idx: number) => {
    const node = e.node || {};
    const image = node.images?.edges?.[0]?.node?.url || "/assets/product-1.jpg";
    const imageAlt = resolveProductImageAlt(node.images?.edges?.[0]?.node?.altText);
    const variant = node.variants?.edges?.[0]?.node;
    const price = variant?.price?.amount ?? "0.00";
    const currency = variant?.price?.currencyCode ?? "INR";
    const compareAtPrice = variant?.compareAtPrice?.amount ?? null;
    const quantity = typeof variant?.quantityAvailable === "number" ? variant.quantityAvailable : undefined;
    const reviews = parseProductReviews(node.reviewsMetafield?.value);
    const reviewStats = getReviewStats(reviews);
      return {
        id: node.id || `shopify-${idx}`,
        title: node.title || "Untitled",
        type: node.productType || "General",
        handle: node.handle || "",
        description: node.description || "",
        image,
        imageAlt,
        price,
        compareAtPrice: compareAtPrice ? String(compareAtPrice) : null,
        currency,
        quantity,
        careLevel: node.metafield?.value || "",
        plantGenus: node.plantGenusMetafield?.value || "",
        potSize: node.potSizeMetafield?.value || "",
        potMaterial: node.potMaterialMetafield?.value || "",
        available: Boolean(node.availableForSale),
        collections: Array.isArray(node.collections?.edges)
          ? node.collections.edges
              .map((edge: any) => String(edge?.node?.handle || "").trim())
              .filter(Boolean)
          : [],
        tags: node.tags || [],
        createdAt: node.createdAt || "",
        badge: "",
        rating: reviewStats.reviewCount > 0 ? reviewStats.averageRating : undefined,
        reviewCount: reviewStats.reviewCount,
        reviews,
    };
  });
}

export async function fetchAllProductsList(options: ProductQueryOptions = {}) {
  const PAGE_SIZE = 250;
  const MAX_PRODUCTS = 5000;
  const sortKey = options.sortKey ?? "BEST_SELLING";
  const reverse = options.reverse ?? false;

  let after: string | null = null;
  const all: any[] = [];

  while (true) {
    const gql = `query Products($first: Int!, $after: String, $sortKey: ProductSortKeys, $reverse: Boolean!) {
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
        edges {
          node {
            id
            title
            productType
             handle
             availableForSale
             metafield(namespace: "custom", key: "care_level") { value }
             ratingMetafield: metafield(namespace: "custom", key: "rating") { value }
             reviewsMetafield: metafield(namespace: "custom", key: "reviews") { value }
             plantGenusMetafield: metafield(namespace: "custom", key: "plant_genus") { value }
             potSizeMetafield: metafield(namespace: "custom", key: "pot_size") { value }
             potMaterialMetafield: metafield(namespace: "custom", key: "pot_material") { value }
             description
             images(first: 1) { edges { node { url altText } } }
             variants(first: 1) { edges { node { price { amount currencyCode } compareAtPrice { amount currencyCode } quantityAvailable } } }
             collections(first: 8) { edges { node { handle } } }
             tags
             createdAt
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`;

    const res = await shopifyFetch(gql, { first: PAGE_SIZE, after, sortKey, reverse });
    if (res.errors) {
      throw new Error(res.errors.map((e: any) => e.message).join(", "));
    }

    const products = res.data?.products;
    const edges = products?.edges ?? [];
    const mapped = edges.map((e: any, idx: number) => {
      const node = e.node || {};
      const image = node.images?.edges?.[0]?.node?.url || "/assets/product-1.jpg";
      const imageAlt = resolveProductImageAlt(node.images?.edges?.[0]?.node?.altText);
      const variant = node.variants?.edges?.[0]?.node;
      const price = variant?.price?.amount ?? "0.00";
      const currency = variant?.price?.currencyCode ?? "INR";
      const compareAtPrice = variant?.compareAtPrice?.amount ?? null;
      const quantity = typeof variant?.quantityAvailable === "number" ? variant.quantityAvailable : undefined;
      const reviews = parseProductReviews(node.reviewsMetafield?.value);
      const reviewStats = getReviewStats(reviews);
      return {
        id: node.id || `shopify-${all.length + idx}`,
        title: node.title || "Untitled",
        type: node.productType || "General",
        handle: node.handle || "",
        description: node.description || "",
        image,
        imageAlt,
        price,
        compareAtPrice: compareAtPrice ? String(compareAtPrice) : null,
        currency,
        quantity,
        careLevel: node.metafield?.value || "",
        plantGenus: node.plantGenusMetafield?.value || "",
        potSize: node.potSizeMetafield?.value || "",
        potMaterial: node.potMaterialMetafield?.value || "",
        available: Boolean(node.availableForSale),
        collections: Array.isArray(node.collections?.edges)
          ? node.collections.edges
              .map((edge: any) => String(edge?.node?.handle || "").trim())
              .filter(Boolean)
          : [],
        tags: node.tags || [],
        createdAt: node.createdAt || "",
        badge: "",
        rating: reviewStats.reviewCount > 0 ? reviewStats.averageRating : undefined,
        reviewCount: reviewStats.reviewCount,
        reviews,
      };
    });

    all.push(...mapped);

    const hasNextPage = Boolean(products?.pageInfo?.hasNextPage);
    const endCursor = products?.pageInfo?.endCursor ?? null;
    if (!hasNextPage || !endCursor || all.length >= MAX_PRODUCTS) break;
    after = endCursor;
  }

  return all;
}

function normalizeHandle(input: unknown): string {
  const raw = Array.isArray(input) ? input[0] : input;
  if (typeof raw !== "string") return "";

  let value = raw.trim();
  if (!value) return "";

  try {
    value = decodeURIComponent(value);
  } catch {}

  value = value.replace(/^\/+|\/+$/g, "");
  if (value.includes("/")) {
    value = value.split("/").pop() || "";
  }

  return value.trim();
}

export async function fetchProductByHandle(handleInput: unknown) {
  const handle = normalizeHandle(handleInput);
  if (!handle) return null;

  const gql = `query ProductByHandle($handle: String!, $faqNamespace: String!, $faqKey: String!, $faqFallbackKey: String!) {
    productByHandle(handle: $handle) {
      id
      title
      handle
      description
      descriptionHtml
      seo {
        title
        description
      }
      titleTagMetafield: metafield(namespace: "global", key: "title_tag") { value }
      descriptionTagMetafield: metafield(namespace: "global", key: "description_tag") { value }
      images(first: 12) { edges { node { url altText } } }
      availableForSale
      variants(first: 1) { edges { node { price { amount currencyCode } compareAtPrice { amount currencyCode } quantityAvailable } } }
      ratingMetafield: metafield(namespace: "custom", key: "rating") { value }
      reviewsMetafield: metafield(namespace: "custom", key: "reviews") { value }
      productFaqsMetafield: metafield(namespace: $faqNamespace, key: $faqKey) { value }
      fallbackProductFaqsMetafield: metafield(namespace: $faqNamespace, key: $faqFallbackKey) { value }
      tags
      createdAt
    }
  }`;

  const res = await shopifyFetch(gql, {
    handle,
    faqNamespace: PRODUCT_FAQS_NAMESPACE,
    faqKey: PRODUCT_FAQS_KEY,
    faqFallbackKey: PRODUCT_FAQS_FALLBACK_KEY,
  });
  if (res.errors) {
    throw new Error(res.errors.map((e: any) => e.message).join(", "));
  }

  const node = res.data?.productByHandle;
  if (!node) return null;

  const imageNodes = (node.images?.edges ?? [])
    .map((edge: any) => edge?.node)
    .filter((imageNode: any) => Boolean(imageNode?.url));
  const images = imageNodes
    .map((imageNode: any) => normalizeImageUrl(imageNode.url, ""))
    .filter((url: string) => Boolean(url));
  const imageAlts = imageNodes.map((imageNode: any) => resolveProductImageAlt(imageNode?.altText));
  const image = images[0] || "/assets/product-1.jpg";
  const imageAlt = imageAlts[0] || resolveProductImageAlt("");
  const variant = node.variants?.edges?.[0]?.node;
  const price = variant?.price?.amount ?? "0.00";
  const currency = variant?.price?.currencyCode ?? "INR";
  const compareAtPrice = variant?.compareAtPrice?.amount ?? null;
  const quantity = typeof variant?.quantityAvailable === "number" ? variant.quantityAvailable : undefined;
  const available = Boolean(node.availableForSale ?? true);
  const plainDescription =
    (typeof node.description === "string" && node.description.trim()) ||
    (typeof node.descriptionHtml === "string"
      ? node.descriptionHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
      : "");
  const seoTitle = cleanText(String(node?.seo?.title ?? node?.titleTagMetafield?.value ?? ""));
  const seoDescription = cleanText(String(node?.seo?.description ?? node?.descriptionTagMetafield?.value ?? ""));
  const reviews = parseProductReviews(node.reviewsMetafield?.value);
  const reviewStats = getReviewStats(reviews);
  const faqs = parseProductFaqs(node.productFaqsMetafield?.value ?? node.fallbackProductFaqsMetafield?.value);
  return {
    id: node.id,
    title: node.title || "Untitled",
    handle: node.handle || handle,
    image,
    imageAlt,
    images,
    imageAlts,
    price,
    compareAtPrice: compareAtPrice ? String(compareAtPrice) : null,
    currency,
    quantity,
    available,
    badge: "",
    rating: reviewStats.reviewCount > 0 ? reviewStats.averageRating : undefined,
    reviewCount: reviewStats.reviewCount,
    reviews,
    faqs,
    description: plainDescription,
    descriptionHtml: typeof node.descriptionHtml === "string" ? node.descriptionHtml : "",
    seoTitle,
    seoDescription,
  };
}

export interface FirebaseArticle {
  id: string;
  handle: string;
  title: string;
  excerpt: string;
  seoDescription: string;
  authorName: string;
  contentHtml: string;
  publishedAt: string;
  image: {
    url: string;
    altText: string;
    width: number;
    height: number;
  } | null;
  blogHandle: string;
  blogTitle: string;
}

function cleanText(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function toExcerpt(excerpt: string, contentHtml: string, maxLength = 160): string {
  const source = cleanText(excerpt) || cleanText(contentHtml);
  if (!source) return "Read this guide for practical succulent care insights and seasonal tips.";
  if (source.length <= maxLength) return source;
  return `${source.slice(0, maxLength).trimEnd()}...`;
}

function mapFirebaseArticle(node: any, blogHandle: string, blogTitle: string): FirebaseArticle | null {
  if (!node?.handle || !node?.title) return null;

  const imageNode = node.image;
  const seoDescription = cleanText(String(node?.seo?.description ?? ""));
  const authorName = cleanText(String(node?.authorV2?.name ?? node?.author?.name ?? ""));
  return {
    id: String(node.id ?? `${blogHandle}-${node.handle}`),
    handle: String(node.handle),
    title: String(node.title),
    excerpt: toExcerpt(String(node.excerpt ?? ""), String(node.contentHtml ?? "")),
    seoDescription: seoDescription || toExcerpt(String(node.excerpt ?? ""), String(node.contentHtml ?? ""), 220),
    authorName: authorName || "Succulent Sphere Editorial Team",
    contentHtml: String(node.contentHtml ?? ""),
    publishedAt: String(node.publishedAt ?? ""),
    image: imageNode?.url
      ? {
          url: String(imageNode.url),
          altText: String(imageNode.altText ?? node.title),
          width: Number(imageNode.width ?? 1600),
          height: Number(imageNode.height ?? 900),
        }
      : null,
    blogHandle,
    blogTitle,
  };
}

export async function fetchPlantCareArticles(limit = 24): Promise<FirebaseArticle[]> {
  const gql = `query PlantCareArticles($firstBlogs: Int!, $firstArticles: Int!) {
    blogs(first: $firstBlogs) {
      edges {
        node {
          handle
          title
          articles(first: $firstArticles, sortKey: PUBLISHED_AT, reverse: true) {
            edges {
              node {
                id
                handle
                title
                excerpt
                seo {
                  description
                }
                authorV2 {
                  name
                }
                contentHtml
                publishedAt
                image {
                  url
                  altText
                  width
                  height
                }
              }
            }
          }
        }
      }
    }
  }`;

  const res = await shopifyFetch(
    gql,
    { firstBlogs: 10, firstArticles: Math.max(limit, 12) },
    { cache: "force-cache", next: { revalidate: 3600, tags: ["plant-care-blogs"] } }
  );
  if (res.errors) {
    throw new Error(res.errors.map((e: any) => e.message).join(", "));
  }
  const flat: FirebaseArticle[] = [];
  const seen = new Set<string>();
  const blogEdges = res.data?.blogs?.edges ?? [];

  for (const edge of blogEdges) {
    const blog = edge?.node;
    const blogHandle = String(blog?.handle ?? "");
    const blogTitle = String(blog?.title ?? "Plant Care");
    const articleEdges = blog?.articles?.edges ?? [];
    for (const articleEdge of articleEdges) {
      const mapped = mapFirebaseArticle(articleEdge?.node, blogHandle, blogTitle);
      if (!mapped || seen.has(mapped.handle)) continue;
      seen.add(mapped.handle);
      flat.push(mapped);
    }
  }

  return flat
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}

export async function fetchPlantCareArticleByHandle(handleInput: unknown): Promise<FirebaseArticle | null> {
  const handle = normalizeHandle(handleInput);
  if (!handle) return null;

  const gql = `query PlantCareArticleByHandle($handle: String!, $firstBlogs: Int!) {
    blogs(first: $firstBlogs) {
      edges {
        node {
          handle
          title
          articleByHandle(handle: $handle) {
            id
            handle
            title
            excerpt
            seo {
              description
            }
            authorV2 {
              name
            }
            contentHtml
            publishedAt
            image {
              url
              altText
              width
              height
            }
          }
        }
      }
    }
  }`;

  const res = await shopifyFetch(
    gql,
    { handle, firstBlogs: 20 },
    { cache: "force-cache", next: { revalidate: 3600, tags: ["plant-care-blogs"] } }
  );
  if (res.errors) {
    throw new Error(res.errors.map((e: any) => e.message).join(", "));
  }

  const blogEdges = res.data?.blogs?.edges ?? [];
  for (const edge of blogEdges) {
    const blog = edge?.node;
    const mapped = mapFirebaseArticle(blog?.articleByHandle, String(blog?.handle ?? ""), String(blog?.title ?? "Plant Care"));
    if (mapped) return mapped;
  }

  return null;
}

export interface FirebaseCustomerOrder {
  id: string;
  orderNumber: number;
  processedAt: string;
  fulfillmentStatus: string;
  financialStatus: string;
  tags?: string[];
  fulfillmentOrderStatuses?: string[];
  tracking?: ShopifyOrderTrackingEntry[];
  fulfillmentEvents?: string[];
  lineItems: FirebaseCustomerOrderLineItem[];
  currentSubtotalPrice?: {
    amount: string;
    currencyCode: string;
  };
  currentTotalShippingPrice?: {
    amount: string;
    currencyCode: string;
  };
  currentTotalTax?: {
    amount: string;
    currencyCode: string;
  };
  currentTotalPrice?: {
    amount: string;
    currencyCode: string;
  };
  totalPrice: {
    amount: string;
    currencyCode: string;
  };
}

export interface ShopifyOrderTrackingEntry {
  number: string;
  url: string;
  company: string;
}

export interface FirebaseCustomerOrderLineItem {
  id: string;
  title: string;
  quantity: number;
  variantTitle: string;
  productHandle: string;
  image: string;
  imageAlt?: string;
  customAttributes?: { key: string; value: string }[];
  originalTotalPrice?: {
    amount: string;
    currencyCode: string;
  };
  discountedTotalPrice?: {
    amount: string;
    currencyCode: string;
  };
  price: {
    amount: string;
    currencyCode: string;
  };
}

export interface FirebaseCustomerAddress {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string;
}

export interface FirebaseAuthenticatedCustomer {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string | null;
  defaultAddressId: string | null;
  addresses: FirebaseCustomerAddress[];
  orders: FirebaseCustomerOrder[];
}

export interface ShopifyCustomerAccessToken {
  accessToken: string;
  expiresAt: string;
}

export async function customerRecover(email: string): Promise<{ success: boolean; userErrors: string[] }> {
  const mutation = `mutation CustomerRecover($email: String!) {
    customerRecover(email: $email) {
      customerUserErrors { message }
    }
  }`;

  const response = await shopifyFetch(mutation, { email });
  const payload = response?.data?.customerRecover;
  const userErrors = mapUserErrors(payload?.customerUserErrors);
  return { success: userErrors.length === 0, userErrors };
}

export async function customerResetByUrl(input: {
  resetUrl: string;
  password: string;
}): Promise<{
  token: ShopifyCustomerAccessToken | null;
  customerEmail: string | null;
  userErrors: string[];
}> {
  const mutation = `mutation CustomerResetByUrl($resetUrl: URL!, $password: String!) {
    customerResetByUrl(resetUrl: $resetUrl, password: $password) {
      customer { email }
      customerAccessToken {
        accessToken
        expiresAt
      }
      customerUserErrors { message }
    }
  }`;

  const response = await shopifyFetch(mutation, input);
  const payload = response?.data?.customerResetByUrl;
  return {
    token: payload?.customerAccessToken || null,
    customerEmail: payload?.customer?.email ? String(payload.customer.email) : null,
    userErrors: mapUserErrors(payload?.customerUserErrors),
  };
}

function mapUserErrors(errors: Array<{ message?: string }> | undefined): string[] {
  return Array.isArray(errors) ? errors.map((error) => String(error?.message || "").trim()).filter(Boolean) : [];
}

export async function createCustomer(input: {
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
}): Promise<{ customerId: string | null; userErrors: string[] }> {
  const mutation = `mutation CreateCustomer($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer { id }
      customerUserErrors { message }
    }
  }`;

  const response = await shopifyFetch(mutation, { input });
  const payload = response?.data?.customerCreate;
  return {
    customerId: payload?.customer?.id || null,
    userErrors: mapUserErrors(payload?.customerUserErrors),
  };
}

export async function createCustomerAccessToken(input: {
  email: string;
  password: string;
}): Promise<{ token: ShopifyCustomerAccessToken | null; userErrors: string[] }> {
  const mutation = `mutation CreateCustomerAccessToken($input: CustomerAccessTokenCreateInput!) {
    customerAccessTokenCreate(input: $input) {
      customerAccessToken {
        accessToken
        expiresAt
      }
      customerUserErrors { message }
    }
  }`;

  const response = await shopifyFetch(mutation, { input });
  const payload = response?.data?.customerAccessTokenCreate;
  return {
    token: payload?.customerAccessToken || null,
    userErrors: mapUserErrors(payload?.customerUserErrors),
  };
}

export async function renewCustomerAccessToken(
  customerAccessToken: string
): Promise<{ token: ShopifyCustomerAccessToken | null; userErrors: string[] }> {
  const mutation = `mutation RenewCustomerAccessToken($customerAccessToken: String!) {
    customerAccessTokenRenew(customerAccessToken: $customerAccessToken) {
      customerAccessToken {
        accessToken
        expiresAt
      }
      userErrors { message }
    }
  }`;

  const response = await shopifyFetch(mutation, { customerAccessToken });
  const payload = response?.data?.customerAccessTokenRenew;
  return {
    token: payload?.customerAccessToken || null,
    userErrors: mapUserErrors(payload?.userErrors),
  };
}

export async function fetchCustomerByAccessToken(
  customerAccessToken: string
): Promise<{ customer: FirebaseAuthenticatedCustomer | null; userErrors: string[] }> {
  const query = `query CustomerProfile($customerAccessToken: String!) {
    customer(customerAccessToken: $customerAccessToken) {
      id
      firstName
      lastName
      displayName
      email
      phone
      defaultAddress {
        id
      }
      addresses(first: 20) {
        edges {
          node {
            id
            firstName
            lastName
            company
            address1
            address2
            city
            province
            country
            zip
            phone
          }
        }
      }
      orders(first: 50, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            id
            orderNumber
            processedAt
            fulfillmentStatus
            financialStatus
            totalPrice {
              amount
              currencyCode
            }
            currentSubtotalPrice {
              amount
              currencyCode
            }
            currentTotalShippingPrice {
              amount
              currencyCode
            }
            currentTotalTax {
              amount
              currencyCode
            }
            currentTotalPrice {
              amount
              currencyCode
            }
            lineItems(first: 50) {
              edges {
                node {
                  title
                  quantity
                  customAttributes {
                    key
                    value
                  }
                  originalTotalPrice {
                    amount
                    currencyCode
                  }
                  discountedTotalPrice {
                    amount
                    currencyCode
                  }
                  variant {
                    title
                    price {
                      amount
                      currencyCode
                    }
                    image {
                      url
                      altText
                    }
                    product {
                      handle
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const response = await shopifyFetch(query, { customerAccessToken });
  if (Array.isArray(response?.errors) && response.errors.length > 0) {
    return {
      customer: null,
      userErrors: response.errors.map((error: { message?: string }) => String(error?.message || "Unable to load customer.")),
    };
  }

  const customer = response?.data?.customer;
  if (!customer?.id) {
    return { customer: null, userErrors: ["Customer session is invalid."] };
  }

  const orders: FirebaseCustomerOrder[] = (customer?.orders?.edges || []).map((edge: any) => ({
    id: String(edge?.node?.id || ""),
    orderNumber: Number(edge?.node?.orderNumber || 0),
    processedAt: String(edge?.node?.processedAt || ""),
    fulfillmentStatus: String(edge?.node?.fulfillmentStatus || "UNFULFILLED"),
    financialStatus: String(edge?.node?.financialStatus || "PENDING"),
    currentSubtotalPrice: edge?.node?.currentSubtotalPrice
      ? {
          amount: String(edge.node.currentSubtotalPrice.amount || "0.00"),
          currencyCode: String(edge.node.currentSubtotalPrice.currencyCode || "INR"),
        }
      : undefined,
    currentTotalShippingPrice: edge?.node?.currentTotalShippingPrice
      ? {
          amount: String(edge.node.currentTotalShippingPrice.amount || "0.00"),
          currencyCode: String(edge.node.currentTotalShippingPrice.currencyCode || "INR"),
        }
      : undefined,
    currentTotalTax: edge?.node?.currentTotalTax
      ? {
          amount: String(edge.node.currentTotalTax.amount || "0.00"),
          currencyCode: String(edge.node.currentTotalTax.currencyCode || "INR"),
        }
      : undefined,
    currentTotalPrice: edge?.node?.currentTotalPrice
      ? {
          amount: String(edge.node.currentTotalPrice.amount || "0.00"),
          currencyCode: String(edge.node.currentTotalPrice.currencyCode || "INR"),
        }
      : undefined,
    lineItems: (edge?.node?.lineItems?.edges || []).map((lineEdge: any, idx: number) => ({
      id: String(lineEdge?.node?.id || `${edge?.node?.id || "order"}-line-${idx}`),
      title: String(lineEdge?.node?.title || "Product"),
      quantity: Number(lineEdge?.node?.quantity || 1),
      variantTitle: String(lineEdge?.node?.variant?.title || ""),
      productHandle: String(lineEdge?.node?.variant?.product?.handle || ""),
      image: normalizeImageUrl(lineEdge?.node?.variant?.image?.url || "", ""),
      imageAlt: resolveProductImageAlt(lineEdge?.node?.variant?.image?.altText),
      customAttributes: Array.isArray(lineEdge?.node?.customAttributes)
        ? lineEdge.node.customAttributes
            .map((attr: any) => ({
              key: String(attr?.key || ""),
              value: String(attr?.value || ""),
            }))
            .filter((attr: { key: string; value: string }) => attr.key)
        : [],
      originalTotalPrice: lineEdge?.node?.originalTotalPrice
        ? {
            amount: String(lineEdge.node.originalTotalPrice.amount || "0.00"),
            currencyCode: String(lineEdge.node.originalTotalPrice.currencyCode || "INR"),
          }
        : undefined,
      discountedTotalPrice: lineEdge?.node?.discountedTotalPrice
        ? {
            amount: String(lineEdge.node.discountedTotalPrice.amount || "0.00"),
            currencyCode: String(lineEdge.node.discountedTotalPrice.currencyCode || "INR"),
          }
        : undefined,
      price: {
        amount: String(lineEdge?.node?.variant?.price?.amount || "0.00"),
        currencyCode: String(lineEdge?.node?.variant?.price?.currencyCode || "INR"),
      },
    })),
    totalPrice: {
      amount: String(edge?.node?.totalPrice?.amount || "0.00"),
      currencyCode: String(edge?.node?.totalPrice?.currencyCode || "USD"),
    },
  }));

  const addresses: FirebaseCustomerAddress[] = (customer?.addresses?.edges || []).map((edge: any) => ({
    id: String(edge?.node?.id || ""),
    firstName: String(edge?.node?.firstName || ""),
    lastName: String(edge?.node?.lastName || ""),
    company: String(edge?.node?.company || ""),
    address1: String(edge?.node?.address1 || ""),
    address2: String(edge?.node?.address2 || ""),
    city: String(edge?.node?.city || ""),
    province: String(edge?.node?.province || ""),
    country: String(edge?.node?.country || ""),
    zip: String(edge?.node?.zip || ""),
    phone: String(edge?.node?.phone || ""),
  }));

  return {
    customer: {
      id: String(customer.id),
      firstName: String(customer.firstName || ""),
      lastName: String(customer.lastName || ""),
      displayName: String(customer.displayName || ""),
      email: String(customer.email || ""),
      phone: customer.phone ? String(customer.phone) : null,
      defaultAddressId: customer?.defaultAddress?.id ? String(customer.defaultAddress.id) : null,
      addresses,
      orders,
    },
    userErrors: [],
  };
}

export async function customerUpdateProfile(
  customerAccessToken: string,
  input: { firstName?: string; lastName?: string; phone?: string }
): Promise<{ success: boolean; userErrors: string[] }> {
  const mutation = `mutation CustomerUpdateProfile($customerAccessToken: String!, $customer: CustomerUpdateInput!) {
    customerUpdate(customerAccessToken: $customerAccessToken, customer: $customer) {
      customer { id }
      customerUserErrors { message }
    }
  }`;

  const response = await shopifyFetch(mutation, { customerAccessToken, customer: input });
  const payload = response?.data?.customerUpdate;
  const userErrors = mapUserErrors(payload?.customerUserErrors);
  return { success: userErrors.length === 0, userErrors };
}

export async function customerUpdatePassword(
  customerAccessToken: string,
  password: string
): Promise<{ success: boolean; userErrors: string[] }> {
  const mutation = `mutation CustomerUpdatePassword($customerAccessToken: String!, $customer: CustomerUpdateInput!) {
    customerUpdate(customerAccessToken: $customerAccessToken, customer: $customer) {
      customer { id }
      customerUserErrors { message }
    }
  }`;

  const response = await shopifyFetch(mutation, { customerAccessToken, customer: { password } });
  const payload = response?.data?.customerUpdate;
  const userErrors = mapUserErrors(payload?.customerUserErrors);
  return { success: userErrors.length === 0, userErrors };
}

export async function customerAddressCreate(
  customerAccessToken: string,
  address: {
    firstName?: string;
    lastName?: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    country: string;
    zip: string;
    phone?: string;
  }
): Promise<{ addressId: string | null; userErrors: string[] }> {
  const mutation = `mutation CustomerAddressCreate($customerAccessToken: String!, $address: MailingAddressInput!) {
    customerAddressCreate(customerAccessToken: $customerAccessToken, address: $address) {
      customerAddress { id }
      customerUserErrors { message }
    }
  }`;

  const response = await shopifyFetch(mutation, { customerAccessToken, address });
  const payload = response?.data?.customerAddressCreate;
  return {
    addressId: payload?.customerAddress?.id ? String(payload.customerAddress.id) : null,
    userErrors: mapUserErrors(payload?.customerUserErrors),
  };
}

export async function customerAddressUpdate(
  customerAccessToken: string,
  id: string,
  address: {
    firstName?: string;
    lastName?: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    country: string;
    zip: string;
    phone?: string;
  }
): Promise<{ addressId: string | null; userErrors: string[] }> {
  const mutation = `mutation CustomerAddressUpdate($customerAccessToken: String!, $id: ID!, $address: MailingAddressInput!) {
    customerAddressUpdate(customerAccessToken: $customerAccessToken, id: $id, address: $address) {
      customerAddress { id }
      customerUserErrors { message }
    }
  }`;

  const response = await shopifyFetch(mutation, { customerAccessToken, id, address });
  const payload = response?.data?.customerAddressUpdate;
  return {
    addressId: payload?.customerAddress?.id ? String(payload.customerAddress.id) : null,
    userErrors: mapUserErrors(payload?.customerUserErrors),
  };
}

export async function customerAddressDelete(
  customerAccessToken: string,
  id: string
): Promise<{ deletedAddressId: string | null; userErrors: string[] }> {
  const mutation = `mutation CustomerAddressDelete($customerAccessToken: String!, $id: ID!) {
    customerAddressDelete(customerAccessToken: $customerAccessToken, id: $id) {
      deletedCustomerAddressId
      customerUserErrors { message }
    }
  }`;

  const response = await shopifyFetch(mutation, { customerAccessToken, id });
  const payload = response?.data?.customerAddressDelete;
  return {
    deletedAddressId: payload?.deletedCustomerAddressId ? String(payload.deletedCustomerAddressId) : null,
    userErrors: mapUserErrors(payload?.customerUserErrors),
  };
}

export async function customerDefaultAddressUpdate(
  customerAccessToken: string,
  addressId: string
): Promise<{ customerId: string | null; userErrors: string[] }> {
  const mutation = `mutation CustomerDefaultAddressUpdate($customerAccessToken: String!, $addressId: ID!) {
    customerDefaultAddressUpdate(customerAccessToken: $customerAccessToken, addressId: $addressId) {
      customer { id }
      customerUserErrors { message }
    }
  }`;

  const response = await shopifyFetch(mutation, { customerAccessToken, addressId });
  const payload = response?.data?.customerDefaultAddressUpdate;
  return {
    customerId: payload?.customer?.id ? String(payload.customer.id) : null,
    userErrors: mapUserErrors(payload?.customerUserErrors),
  };
}

export type ShopifyWishlistProduct = {
  id: string;
  title: string;
  handle: string;
  image: string;
  imageAlt?: string;
  price: string;
  compareAtPrice?: string | null;
  currency: string;
  available: boolean;
};

type CustomerWishlistMetafield = {
  id: string | null;
  value: string | null;
};

const CUSTOMER_WISHLIST_NAMESPACE = process.env.SHOPIFY_WISHLIST_NAMESPACE || "custom";
const CUSTOMER_WISHLIST_KEY = process.env.SHOPIFY_WISHLIST_KEY || "wishlist";

export async function fetchCustomerWishlistMetafield(
  customerId: string
): Promise<{ metafield: CustomerWishlistMetafield; userErrors: string[] }> {
  const query = `query CustomerWishlistMetafield($id: ID!, $namespace: String!, $key: String!) {
    customer(id: $id) {
      id
      metafield(namespace: $namespace, key: $key) {
        id
        value
      }
    }
  }`;

  const response = await shopifyAdminFetch(query, {
    id: customerId,
    namespace: CUSTOMER_WISHLIST_NAMESPACE,
    key: CUSTOMER_WISHLIST_KEY,
  });

  if (Array.isArray(response?.errors) && response.errors.length > 0) {
    return {
      metafield: { id: null, value: null },
      userErrors: response.errors.map((error: { message?: string }) => String(error?.message || "Unable to load wishlist.")),
    };
  }

  return {
    metafield: {
      id: response?.data?.customer?.metafield?.id ? String(response.data.customer.metafield.id) : null,
      value: response?.data?.customer?.metafield?.value ? String(response.data.customer.metafield.value) : null,
    },
    userErrors: [],
  };
}

export async function fetchCustomerWishlistMetafieldByAccessToken(
  customerAccessToken: string
): Promise<{ metafield: CustomerWishlistMetafield; userErrors: string[] }> {
  const query = `query CustomerWishlistByAccessToken($customerAccessToken: String!, $namespace: String!, $key: String!) {
    customer(customerAccessToken: $customerAccessToken) {
      metafield(namespace: $namespace, key: $key) {
        id
        value
      }
    }
  }`;

  const response = await shopifyFetch(query, {
    customerAccessToken,
    namespace: CUSTOMER_WISHLIST_NAMESPACE,
    key: CUSTOMER_WISHLIST_KEY,
  });

  if (Array.isArray(response?.errors) && response.errors.length > 0) {
    return {
      metafield: { id: null, value: null },
      userErrors: response.errors.map((error: { message?: string }) => String(error?.message || "Unable to load wishlist.")),
    };
  }

  return {
    metafield: {
      id: response?.data?.customer?.metafield?.id ? String(response.data.customer.metafield.id) : null,
      value: response?.data?.customer?.metafield?.value ? String(response.data.customer.metafield.value) : null,
    },
    userErrors: [],
  };
}

export async function updateCustomerWishlistMetafield(
  customerId: string,
  value: string
): Promise<{ success: boolean; userErrors: string[] }> {
  const mutation = `mutation CustomerWishlistMetafieldsSet(
    $metafields: [MetafieldsSetInput!]!
  ) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message code }
    }
  }`;

  const configuredType = String(process.env.SHOPIFY_WISHLIST_METAFIELD_TYPE || "json").trim() || "json";
  const metafieldTypes = Array.from(new Set([configuredType, "json", "list.product_reference", "single_line_text_field"]));
  const collectedErrors: string[] = [];

  for (const metafieldType of metafieldTypes) {
    const response = await shopifyAdminFetch(mutation, {
      metafields: [
        {
          ownerId: customerId,
          namespace: CUSTOMER_WISHLIST_NAMESPACE,
          key: CUSTOMER_WISHLIST_KEY,
          type: metafieldType,
          value,
        },
      ],
    });

    const topLevelErrors = Array.isArray(response?.errors)
      ? response.errors.map((error: { message?: string }) => String(error?.message || "Unable to update wishlist."))
      : [];

    const payload = response?.data?.metafieldsSet;
    const userErrors = mapUserErrors(payload?.userErrors);
    const errors = [...topLevelErrors, ...userErrors];

    const persistedMetafieldId = payload?.metafields?.[0]?.id ? String(payload.metafields[0].id) : "";
    if (persistedMetafieldId && errors.length === 0) {
      return { success: true, userErrors: [] };
    }

    collectedErrors.push(...errors.map((error) => `${metafieldType}: ${error}`));
  }

  if (collectedErrors.length === 0) {
    collectedErrors.push(
      "Wishlist update was not persisted. Ensure the customer metafield definition exists and the Admin API token has customer metafield write scopes."
    );
  }
  return { success: false, userErrors: Array.from(new Set(collectedErrors)) };
}

export async function fetchProductsByIds(ids: string[]): Promise<ShopifyWishlistProduct[]> {
  if (!ids.length) return [];
  const normalizedIds = Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)));
  if (!normalizedIds.length) return [];

  const query = `query ProductsByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        title
        handle
        availableForSale
        featuredImage {
          url
          altText
        }
        variants(first: 1) {
          edges {
            node {
              price { amount currencyCode }
              compareAtPrice { amount currencyCode }
            }
          }
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }`;

  const response = await shopifyFetch(
    query,
    { ids: normalizedIds },
    { cache: "force-cache", next: { revalidate: 300, tags: ["wishlist-products"] } }
  );
  if (Array.isArray(response?.errors) && response.errors.length > 0) {
    throw new Error(response.errors.map((error: { message?: string }) => String(error?.message || "")).join(", "));
  }

  const byId = new Map<string, ShopifyWishlistProduct>();
  for (const node of response?.data?.nodes || []) {
    if (!node?.id || !node?.handle) continue;
    const variant = node?.variants?.edges?.[0]?.node;
    const price = variant?.price?.amount ?? node?.priceRange?.minVariantPrice?.amount ?? "0.00";
    const currency = variant?.price?.currencyCode ?? node?.priceRange?.minVariantPrice?.currencyCode ?? "INR";
    const compareAtPrice = variant?.compareAtPrice?.amount ?? null;
    byId.set(String(node.id), {
      id: String(node.id),
      title: String(node.title || "Untitled"),
      handle: String(node.handle || ""),
      image: normalizeImageUrl(node?.featuredImage?.url || "", "/images/succulent-collection.webp"),
      imageAlt: resolveProductImageAlt(node?.featuredImage?.altText),
      price: String(price),
      compareAtPrice: compareAtPrice ? String(compareAtPrice) : null,
      currency: String(currency),
      available: Boolean(node?.availableForSale),
    });
  }

  return normalizedIds.map((id) => byId.get(id)).filter((item): item is ShopifyWishlistProduct => Boolean(item));
}

