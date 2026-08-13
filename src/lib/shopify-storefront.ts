import "server-only";

const SHOPIFY_STOREFRONT_API_VERSION = "2026-01";

export type ShopifyStorefrontGraphQLError = {
  message?: string;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
};

export class ShopifyStorefrontApiError extends Error {
  statusCode: number;
  graphQLErrors: ShopifyStorefrontGraphQLError[];

  constructor(message: string, statusCode = 500, graphQLErrors: ShopifyStorefrontGraphQLError[] = []) {
    super(message);
    this.name = "ShopifyStorefrontApiError";
    this.statusCode = statusCode;
    this.graphQLErrors = graphQLErrors;
  }
}

export type CustomerOrderTrackingEntry = {
  number: string;
  url: string;
  company: string;
};

export type CustomerOrderHistoryItem = {
  name: string;
  processedAt: string;
  fulfillmentStatus: string;
  financialStatus: string;
  trackingInfo: CustomerOrderTrackingEntry[];
};

function normalizeStoreDomain(input: string): string {
  return String(input || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .split("/")[0];
}

function getStorefrontConfig() {
  const domain = normalizeStoreDomain(process.env.SHOPIFY_STORE_DOMAIN || "");
  const storefrontToken = String(process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || "").trim();

  if (!domain) {
    throw new ShopifyStorefrontApiError("Missing environment variable: SHOPIFY_STORE_DOMAIN", 500);
  }
  if (!storefrontToken) {
    throw new ShopifyStorefrontApiError("Missing environment variable: SHOPIFY_STOREFRONT_ACCESS_TOKEN", 500);
  }

  return { domain, storefrontToken };
}

function normalizeGraphQLErrors(errors: unknown): ShopifyStorefrontGraphQLError[] {
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

export async function shopifyStorefrontGraphql<TData>(query: string, variables: Record<string, unknown> = {}): Promise<TData> {
  const { domain, storefrontToken } = getStorefrontConfig();

  const response = await fetch(`https://${domain}/api/${SHOPIFY_STOREFRONT_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": storefrontToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const json = (await response.json()) as {
    data?: TData;
    errors?: ShopifyStorefrontGraphQLError[];
  };

  const graphQLErrors = normalizeGraphQLErrors(json?.errors);
  if (!response.ok) {
    throw new ShopifyStorefrontApiError(
      "Shopify Storefront API request failed.",
      response.status,
      graphQLErrors
    );
  }

  if (graphQLErrors.length > 0) {
    throw new ShopifyStorefrontApiError("Shopify Storefront API returned GraphQL errors.", 502, graphQLErrors);
  }

  if (!json?.data) {
    throw new ShopifyStorefrontApiError("Shopify Storefront API returned an empty response.", 502);
  }

  return json.data;
}

export async function fetchCustomerOrderHistory(
  customerAccessToken: string,
  limit = 10
): Promise<CustomerOrderHistoryItem[]> {
  const cleanToken = String(customerAccessToken || "").trim();
  if (!cleanToken) {
    throw new ShopifyStorefrontApiError("customerAccessToken is required.", 400);
  }

  const first = Math.max(1, Math.min(limit, 10));

  const query = `query CustomerOrderHistory($customerAccessToken: String!, $first: Int!) {
    customer(customerAccessToken: $customerAccessToken) {
      orders(first: $first, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            name
            processedAt
            fulfillmentStatus
            financialStatus
            successfulFulfillments {
              trackingCompany
              trackingInfo(first: 20) {
                number
                url
              }
            }
          }
        }
      }
    }
  }`;

  const data = await shopifyStorefrontGraphql<{
    customer?: {
      orders?: {
        edges?: Array<{
          node?: {
            name?: string;
            processedAt?: string;
            fulfillmentStatus?: string;
            financialStatus?: string;
            successfulFulfillments?: Array<{
              trackingCompany?: string;
              trackingInfo?: Array<{
                number?: string;
                url?: string;
              }>;
            }>;
          };
        }>;
      };
    } | null;
  }>(query, { customerAccessToken: cleanToken, first });

  if (!data?.customer) {
    return [];
  }

  const edges = Array.isArray(data?.customer?.orders?.edges) ? data.customer.orders.edges : [];

  return edges.map((edge) => {
    const order = edge?.node || {};
    const successfulFulfillments = Array.isArray(order.successfulFulfillments) ? order.successfulFulfillments : [];
    const trackingInfo = successfulFulfillments
      .flatMap((fulfillment) => {
        const company = String(fulfillment?.trackingCompany || "").trim();
        const info = Array.isArray(fulfillment?.trackingInfo) ? fulfillment.trackingInfo : [];
        return info.map((tracking) => ({
          number: String(tracking?.number || "").trim(),
          url: String(tracking?.url || "").trim(),
          company,
        }));
      })
      .map((tracking) => ({
        number: tracking.number,
        url: tracking.url,
        company: tracking.company,
      }))
      .filter((tracking) => tracking.number || tracking.url || tracking.company);

    return {
      name: String(order.name || ""),
      processedAt: String(order.processedAt || ""),
      fulfillmentStatus: String(order.fulfillmentStatus || "UNFULFILLED"),
      financialStatus: String(order.financialStatus || "PENDING"),
      trackingInfo,
    };
  });
}
