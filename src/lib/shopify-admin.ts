import "server-only";
import type { FirebaseCustomerOrder } from "./shopify";
import { getShopifyAdminAccessToken } from "./shopifyAdminToken";

const SHOPIFY_ADMIN_API_VERSION = "2026-01";

export type ShopifyGraphQLError = {
  message?: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
};

export type OrderTrackingEntry = {
  number: string;
  url: string;
  company: string;
};

export type TrackedOrder = {
  name: string;
  processedAt: string;
  fulfillmentStatus: string;
  financialStatus: string;
  tracking: OrderTrackingEntry[];
  paymentGatewayNames?: string[];
  tags?: string[];
  fulfillmentOrderStatuses?: string[];
  fulfillmentEvents?: string[];
  lineItems?: Array<{
    id: string;
    title: string;
    quantity: number;
    productHandle: string;
    image: string;
    imageAlt?: string;
    customAttributes?: { key: string; value: string }[];
    originalTotalPrice?: { amount: string; currencyCode: string };
    discountedTotalPrice?: { amount: string; currencyCode: string };
    price: { amount: string; currencyCode: string };
  }>;
};

export class ShopifyAdminApiError extends Error {
  statusCode: number;
  graphQLErrors: ShopifyGraphQLError[];

  constructor(message: string, statusCode = 500, graphQLErrors: ShopifyGraphQLError[] = []) {
    super(message);
    this.name = "ShopifyAdminApiError";
    this.statusCode = statusCode;
    this.graphQLErrors = graphQLErrors;
  }
}

type AdminOrderNode = {
  name?: string;
  processedAt?: string;
  displayFulfillmentStatus?: string;
  displayFinancialStatus?: string;
  paymentGatewayNames?: string[];
  lineItems?: {
    edges?: Array<{
      node?: {
        id?: string;
        title?: string;
        quantity?: number;
        customAttributes?: Array<{ key?: string; value?: string }>;
        originalTotalSet?: { shopMoney?: { amount?: string; currencyCode?: string } };
        discountedTotalSet?: { shopMoney?: { amount?: string; currencyCode?: string } };
        variant?: {
          price?: { amount?: string; currencyCode?: string };
          image?: { url?: string; altText?: string };
          product?: { handle?: string };
        };
      };
    }>;
  };
  fulfillments?: Array<{
    status?: string;
    trackingInfo?: Array<{
      number?: string;
      url?: string;
      company?: string;
    }>;
    events?: {
      nodes?: Array<{
        status?: string;
      }>;
    };
  }>;
  tags?: string[];
  fulfillmentOrders?: {
    nodes?: Array<{
      status?: string;
    }>;
  };
};

function normalizeStoreDomain(input: string): string {
  return String(input || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .split("/")[0];
}

async function getAdminApiConfig() {
  const domain = normalizeStoreDomain(process.env.SHOPIFY_STORE_DOMAIN || "");
  const token = await getShopifyAdminAccessToken();

  if (!domain) {
    throw new ShopifyAdminApiError("Missing environment variable: SHOPIFY_STORE_DOMAIN", 500);
  }
  if (!token) {
    throw new ShopifyAdminApiError("Missing Shopify admin credentials.", 500);
  }

  return { domain, token };
}

function normalizeGraphQLErrors(errors: unknown): ShopifyGraphQLError[] {
  if (!Array.isArray(errors)) return [];
  return errors
    .map((error) => {
      if (!error || typeof error !== "object") return {};
      const e = error as Record<string, unknown>;
      return {
        message: typeof e.message === "string" ? e.message : undefined,
        path: Array.isArray(e.path) ? (e.path as Array<string | number>) : undefined,
        extensions: typeof e.extensions === "object" && e.extensions !== null
          ? (e.extensions as Record<string, unknown>)
          : undefined,
      };
    })
    .filter((error) => Boolean(error.message));
}

export async function shopifyAdminGraphql<TData>(query: string, variables: Record<string, unknown> = {}): Promise<TData> {
  const { domain, token } = await getAdminApiConfig();

  const response = await fetch(`https://${domain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const json = (await response.json()) as {
    data?: TData;
    errors?: ShopifyGraphQLError[];
  };

  const graphQLErrors = normalizeGraphQLErrors(json?.errors);
  if (!response.ok) {
    throw new ShopifyAdminApiError(
      "Shopify Admin API request failed.",
      response.status,
      graphQLErrors
    );
  }

  if (graphQLErrors.length > 0) {
    throw new ShopifyAdminApiError("Shopify Admin API returned GraphQL errors.", 502, graphQLErrors);
  }

  if (!json?.data) {
    throw new ShopifyAdminApiError("Shopify Admin API returned an empty response.", 502);
  }

  return json.data;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeTagList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((tag) => String(tag || "").trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

export function sanitizeEmail(input: unknown): string {
  return String(input || "").trim().toLowerCase();
}

export function sanitizeOrderNumber(input: unknown): string {
  const normalized = String(input || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^#+/, "");
  return normalized;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidOrderNumber(orderNumber: string): boolean {
  if (!orderNumber) return false;
  if (orderNumber.length > 64) return false;
  return /^[a-zA-Z0-9-]+$/.test(orderNumber);
}

function mapTracking(order: AdminOrderNode): OrderTrackingEntry[] {
  const fulfillments = Array.isArray(order?.fulfillments) ? order.fulfillments : [];

  const entries = fulfillments.flatMap((fulfillment) => {
    const trackingInfo = Array.isArray(fulfillment?.trackingInfo) ? fulfillment.trackingInfo : [];
    return trackingInfo.map((item) => ({
      number: String(item?.number || "").trim(),
      url: String(item?.url || "").trim(),
      company: String(item?.company || "").trim(),
    }));
  });

  const uniqueByComposite = new Set<string>();
  const unique: OrderTrackingEntry[] = [];

  for (const entry of entries) {
    if (!entry.number && !entry.url && !entry.company) continue;
    const key = `${entry.number}|${entry.url}|${entry.company}`;
    if (uniqueByComposite.has(key)) continue;
    uniqueByComposite.add(key);
    unique.push(entry);
  }

  return unique;
}

function mapFulfillmentEvents(order: AdminOrderNode): string[] {
  const fulfillments = Array.isArray(order?.fulfillments) ? order.fulfillments : [];
  const events = fulfillments.flatMap((fulfillment) => {
    const nodes = Array.isArray(fulfillment?.events?.nodes) ? fulfillment.events.nodes : [];
    return nodes.map((event) => String(event?.status || "").trim()).filter(Boolean);
  });
  return dedupe(events);
}

function toTrackedOrder(order: AdminOrderNode): TrackedOrder {
  const lineItemsEdges = Array.isArray(order?.lineItems?.edges) ? order.lineItems.edges : [];
  const lineItems = lineItemsEdges.map((edge, idx) => {
    const node = edge?.node || {};
    const variant = node?.variant || {};
    const priceValue = variant?.price;
    const image = variant?.image || {};
    const product = variant?.product || {};
    const originalSet = node?.originalTotalSet?.shopMoney || {};
    const discountedSet = node?.discountedTotalSet?.shopMoney || {};
    const customAttributes = Array.isArray(node?.customAttributes)
      ? node.customAttributes
          .map((attr) => ({
            key: String(attr?.key || ""),
            value: String(attr?.value || ""),
          }))
          .filter((attr) => attr.key)
      : [];

    return {
      id: String(node.id || `${order?.name || "order"}-line-${idx}`),
      title: String(node.title || "Product"),
      quantity: Number(node.quantity || 1),
      productHandle: String(product.handle || ""),
      image: String(image.url || ""),
      imageAlt: image.altText ? String(image.altText) : undefined,
      customAttributes,
      originalTotalPrice: originalSet?.amount
        ? {
            amount: String(originalSet.amount),
            currencyCode: String(originalSet.currencyCode || "INR"),
          }
        : undefined,
      discountedTotalPrice: discountedSet?.amount
        ? {
            amount: String(discountedSet.amount),
            currencyCode: String(discountedSet.currencyCode || "INR"),
          }
        : undefined,
      price: {
        amount: String(priceValue ?? "0.00"),
        currencyCode: String(discountedSet.currencyCode || originalSet.currencyCode || "INR"),
      },
    };
  });

  return {
    name: String(order?.name || ""),
    processedAt: String(order?.processedAt || ""),
    fulfillmentStatus: String(order?.displayFulfillmentStatus || "UNFULFILLED"),
    financialStatus: String(order?.displayFinancialStatus || "PENDING"),
    tracking: mapTracking(order),
    paymentGatewayNames: Array.isArray(order?.paymentGatewayNames)
      ? order.paymentGatewayNames.map((name) => String(name || "")).filter(Boolean)
      : [],
    tags: normalizeTagList(order?.tags),
    fulfillmentOrderStatuses: Array.isArray(order?.fulfillmentOrders?.nodes)
      ? order.fulfillmentOrders.nodes.map((node) => String(node?.status || "")).filter(Boolean)
      : [],
    fulfillmentEvents: mapFulfillmentEvents(order),
    lineItems,
  };
}

export async function findOrderByEmailAndNumber(email: string, orderNumber: string): Promise<TrackedOrder | null> {
  const numericOrderToken = sanitizeOrderNumber(orderNumber);
  const orderSearchTerms = dedupe([numericOrderToken, `#${numericOrderToken}`]);

  const query = `query FindOrderByNameAndEmail($query: String!) {
    orders(first: 1, query: $query, sortKey: PROCESSED_AT, reverse: true) {
      nodes {
        name
        processedAt
        displayFulfillmentStatus
        displayFinancialStatus
        paymentGatewayNames
        tags
        fulfillmentOrders(first: 10) {
          nodes {
            status
          }
        }
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              quantity
              customAttributes {
                key
                value
              }
              originalTotalSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              discountedTotalSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              variant {
                price
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
        fulfillments {
          status
          trackingInfo {
            number
            url
            company
          }
          events(first: 20) {
            nodes {
              status
            }
          }
        }
      }
    }
  }`;

  for (const term of orderSearchTerms) {
    const search = `name:${term} email:${email}`;

    const data = await shopifyAdminGraphql<{
      orders?: { nodes?: AdminOrderNode[] };
    }>(query, { query: search });

    const orderNode = data?.orders?.nodes?.[0];
    if (orderNode?.name) {
      return toTrackedOrder(orderNode);
    }
  }

  return null;
}

export async function fetchCustomerOrdersByEmail(
  emailInput: string,
  limit = 20
): Promise<FirebaseCustomerOrder[]> {
  const email = sanitizeEmail(emailInput);
  if (!isValidEmail(email)) return [];

  const safeLimit = Math.max(1, Math.min(limit, 50));

  const query = `query OrdersByEmail($query: String!, $first: Int!) {
    orders(first: $first, query: $query, sortKey: PROCESSED_AT, reverse: true) {
      nodes {
        id
        name
        processedAt
        displayFulfillmentStatus
        displayFinancialStatus
        tags
        fulfillmentOrders(first: 10) {
          nodes {
            status
          }
        }
        fulfillments {
          status
          trackingInfo {
            number
            url
            company
          }
          events(first: 20) {
            nodes {
              status
            }
          }
        }
        subtotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalShippingSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalTaxSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        lineItems(first: 50) {
          edges {
            node {
              id
              name
              quantity
              customAttributes {
                key
                value
              }
              variant {
                title
                product {
                  handle
                }
                image {
                  url
                  altText
                }
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }`;

  const data = await shopifyAdminGraphql<{
    orders?: { nodes?: Array<Record<string, any>> };
  }>(query, { query: `email:${email}`, first: safeLimit });

  const nodes = Array.isArray(data?.orders?.nodes) ? data.orders.nodes : [];

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[Admin][OrdersByEmail] lookup", {
      email,
      count: nodes.length,
    });
  }

  return nodes.map((node, orderIdx) => {
    const name = String(node?.name || "");
    const orderNumberMatch = name.match(/\d+/);
    const orderNumber = Number(orderNumberMatch?.[0] || 0);

    const totalMoney = node?.totalPriceSet?.shopMoney || {};
    const totalAmount = String(totalMoney?.amount ?? "0.00");
    const totalCurrency = String(totalMoney?.currencyCode ?? "INR");
    const subtotalMoney = node?.subtotalPriceSet?.shopMoney || {};
    const shippingMoney = node?.totalShippingSet?.shopMoney || {};
    const taxMoney = node?.totalTaxSet?.shopMoney || {};

    const lineItemsEdges = Array.isArray(node?.lineItems?.edges) ? node.lineItems.edges : [];
    const lineItems = lineItemsEdges.map((edge: any, idx: number) => {
      const li = edge?.node || {};
      const variant = li?.variant || {};
      const variantPrice = variant?.price || {};
      const variantImage = variant?.image || {};
      const product = variant?.product || {};
      const customAttributes = Array.isArray(li?.customAttributes)
        ? li.customAttributes
            .map((attr: any) => ({
              key: String(attr?.key || ""),
              value: String(attr?.value || ""),
            }))
            .filter((attr: { key: string }) => attr.key)
        : [];

      return {
        id: String(li.id || `${node?.id || "order"}-line-${idx}`),
        title: String(li.name || "Product"),
        quantity: Number(li.quantity || 1),
        variantTitle: String(variant.title || ""),
        productHandle: String(product.handle || ""),
        image: String(variantImage.url || ""),
        imageAlt: undefined,
        customAttributes,
        price: {
          amount: String(variantPrice.amount ?? "0.00"),
          currencyCode: String(variantPrice.currencyCode ?? totalCurrency),
        },
      };
    });

    const order: FirebaseCustomerOrder = {
      id: String(node?.id || `order-${orderIdx}`),
      orderNumber,
      processedAt: String(node?.processedAt || ""),
      fulfillmentStatus: String(node?.displayFulfillmentStatus || "UNFULFILLED"),
      financialStatus: String(node?.displayFinancialStatus || "PENDING"),
      tags: normalizeTagList(node?.tags),
      fulfillmentOrderStatuses: Array.isArray(node?.fulfillmentOrders?.nodes)
        ? node.fulfillmentOrders.nodes.map((fo: any) => String(fo?.status || "")).filter(Boolean)
        : [],
      fulfillmentEvents: mapFulfillmentEvents(node as AdminOrderNode),
      tracking: mapTracking(node as AdminOrderNode),
      lineItems,
      currentSubtotalPrice: subtotalMoney?.amount
        ? {
            amount: String(subtotalMoney.amount ?? "0.00"),
            currencyCode: String(subtotalMoney.currencyCode || totalCurrency),
          }
        : undefined,
      currentTotalShippingPrice: shippingMoney?.amount
        ? {
            amount: String(shippingMoney.amount ?? "0.00"),
            currencyCode: String(shippingMoney.currencyCode || totalCurrency),
          }
        : undefined,
      currentTotalTax: taxMoney?.amount
        ? {
            amount: String(taxMoney.amount ?? "0.00"),
            currencyCode: String(taxMoney.currencyCode || totalCurrency),
          }
        : undefined,
      currentTotalPrice: totalAmount
        ? {
            amount: totalAmount,
            currencyCode: totalCurrency,
          }
        : undefined,
      totalPrice: {
        amount: totalAmount,
        currencyCode: totalCurrency,
      },
    };

    return order;
  });
}

export async function fetchCustomerIdsByEmail(
  emailInput: string,
  limit = 5
): Promise<Array<{ id: string; createdAt: string }>> {
  const email = sanitizeEmail(emailInput);
  if (!isValidEmail(email)) return [];

  const safeLimit = Math.max(1, Math.min(limit, 10));
  const query = `query CustomersByEmail($query: String!, $first: Int!) {
    customers(first: $first, query: $query) {
      nodes {
        id
        createdAt
      }
    }
  }`;

  const data = await shopifyAdminGraphql<{
    customers?: { nodes?: Array<{ id?: string; createdAt?: string }> };
  }>(query, { query: `email:${email}`, first: safeLimit });

  const nodes = Array.isArray(data?.customers?.nodes) ? data.customers.nodes : [];
  return nodes
    .map((node) => ({
      id: String(node?.id || ""),
      createdAt: String(node?.createdAt || ""),
    }))
    .filter((node) => node.id);
}

export async function mergeCustomersByEmail(
  emailInput: string,
  preferredCustomerId?: string
): Promise<{ merged: boolean; resultingCustomerId: string | null; userErrors: string[] }> {
  const candidates = await fetchCustomerIdsByEmail(emailInput, 10);
  if (candidates.length <= 1) {
    return {
      merged: false,
      resultingCustomerId: candidates[0]?.id || null,
      userErrors: [],
    };
  }

  const normalizedPreferred = String(preferredCustomerId || "").trim();
  const preferredMatch = candidates.find((c) => c.id === normalizedPreferred);
  const primary = preferredMatch
    ? preferredMatch
    : [...candidates].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())[0];

  let resultingCustomerId = primary?.id || null;
  const userErrors: string[] = [];

  const mutation = `mutation CustomerMerge($customerOneId: ID!, $customerTwoId: ID!) {
    customerMerge(customerOneId: $customerOneId, customerTwoId: $customerTwoId) {
      resultingCustomerId
      userErrors { message }
    }
  }`;

  for (const candidate of candidates) {
    if (!primary?.id || candidate.id === primary.id) continue;
    const data = await shopifyAdminGraphql<{
      customerMerge?: { resultingCustomerId?: string; userErrors?: Array<{ message?: string }> };
    }>(mutation, { customerOneId: primary.id, customerTwoId: candidate.id });

    const payload = data?.customerMerge;
    const errors = Array.isArray(payload?.userErrors)
      ? payload!.userErrors!.map((error) => String(error?.message || "").trim()).filter(Boolean)
      : [];
    if (errors.length > 0) {
      userErrors.push(...errors);
      continue;
    }
    if (payload?.resultingCustomerId) {
      resultingCustomerId = String(payload.resultingCustomerId);
    }
  }

  return {
    merged: userErrors.length === 0 && candidates.length > 1,
    resultingCustomerId,
    userErrors: Array.from(new Set(userErrors)),
  };
}
