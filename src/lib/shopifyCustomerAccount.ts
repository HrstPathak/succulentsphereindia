import type { FirebaseAuthenticatedCustomer } from "./shopify";

type OidcConfig = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  token_type?: string;
  scope?: string;
};

let configCache: OidcConfig | null = null;

function normalizeBaseIssuer() {
  const explicitIssuer = String(process.env.SHOPIFY_CUSTOMER_ACCOUNT_ISSUER || "").trim();
  if (explicitIssuer) return explicitIssuer.replace(/\/+$/, "");

  const shopId = String(process.env.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID || "").trim();
  if (shopId) return `https://shopify.com/authentication/${shopId}`;
  return "";
}

async function resolveOidcConfig(): Promise<OidcConfig> {
  if (configCache) return configCache;

  const authEndpoint = String(process.env.SHOPIFY_CUSTOMER_ACCOUNT_AUTHORIZATION_ENDPOINT || "").trim();
  const tokenEndpoint = String(process.env.SHOPIFY_CUSTOMER_ACCOUNT_TOKEN_ENDPOINT || "").trim();
  const userInfoEndpoint = String(process.env.SHOPIFY_CUSTOMER_ACCOUNT_USERINFO_ENDPOINT || "").trim();
  if (authEndpoint && tokenEndpoint) {
    configCache = {
      authorization_endpoint: authEndpoint,
      token_endpoint: tokenEndpoint,
      ...(userInfoEndpoint ? { userinfo_endpoint: userInfoEndpoint } : {}),
    };
    return configCache;
  }

  const issuer = normalizeBaseIssuer();
  if (!issuer) {
    throw new Error("Shopify Customer Account OAuth is not configured. Add SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID or SHOPIFY_CUSTOMER_ACCOUNT_ISSUER.");
  }

  const response = await fetch(`${issuer}/.well-known/openid-configuration`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load Shopify Customer Account OpenID configuration.");
  }
  const json = (await response.json()) as OidcConfig;
  if (!json.authorization_endpoint || !json.token_endpoint) {
    throw new Error("Shopify Customer Account OpenID configuration is incomplete.");
  }
  configCache = json;
  return configCache;
}

export async function getShopifyCustomerAuthorizationEndpoint() {
  const cfg = await resolveOidcConfig();
  return cfg.authorization_endpoint;
}

export async function getShopifyCustomerLogoutEndpoint() {
  const cfg = await resolveOidcConfig();
  return cfg.end_session_endpoint || "";
}

function getClientId() {
  const value = String(process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID || "").trim();
  if (!value) throw new Error("Missing SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID.");
  return value;
}

function getClientSecret() {
  return String(process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET || "").trim();
}

export function getShopifyCustomerRedirectUri(request: Request) {
  const explicit = String(process.env.SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI || "").trim();
  if (explicit) return explicit;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/api/auth/shopify/callback`;
}

export function getShopifyCustomerScopes() {
  const explicit = String(process.env.SHOPIFY_CUSTOMER_ACCOUNT_SCOPE || "").trim();
  if (explicit) return explicit;
  return "openid email profile phone customer-account-api:full";
}

function secondsToIso(expiresIn?: number) {
  const ttl = Number.isFinite(Number(expiresIn)) ? Math.max(60, Number(expiresIn)) : 3600;
  return new Date(Date.now() + ttl * 1000).toISOString();
}

export async function exchangeOAuthCode(params: { code: string; redirectUri: string }) {
  const cfg = await resolveOidcConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: getClientId(),
    code: params.code,
    redirect_uri: params.redirectUri,
  });
  const clientSecret = getClientSecret();
  if (clientSecret) body.set("client_secret", clientSecret);

  const response = await fetch(cfg.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(json?.error_description || json?.error || "OAuth code exchange failed."));
  }

  const token = json as unknown as TokenResponse;
  if (!token.access_token) {
    throw new Error("OAuth code exchange did not return an access token.");
  }
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || "",
    expiresAt: secondsToIso(token.expires_in),
    idToken: token.id_token || "",
  };
}

export async function refreshOAuthToken(refreshToken: string) {
  if (!refreshToken) {
    throw new Error("Missing refresh token.");
  }
  const cfg = await resolveOidcConfig();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: getClientId(),
    refresh_token: refreshToken,
  });
  const clientSecret = getClientSecret();
  if (clientSecret) body.set("client_secret", clientSecret);

  const response = await fetch(cfg.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(json?.error_description || json?.error || "OAuth refresh failed."));
  }

  const token = json as unknown as TokenResponse;
  if (!token.access_token) {
    throw new Error("OAuth refresh did not return an access token.");
  }
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || refreshToken,
    expiresAt: secondsToIso(token.expires_in),
    idToken: token.id_token || "",
  };
}

type UserInfoPayload = {
  sub?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  phone_number?: string;
};

const IN_STATE_NAME_TO_CODE: Record<string, string> = {
  "Andhra Pradesh": "AP",
  "Arunachal Pradesh": "AR",
  Assam: "AS",
  Bihar: "BR",
  Chhattisgarh: "CT",
  Goa: "GA",
  Gujarat: "GJ",
  Haryana: "HR",
  "Himachal Pradesh": "HP",
  Jharkhand: "JH",
  Karnataka: "KA",
  Kerala: "KL",
  "Madhya Pradesh": "MP",
  Maharashtra: "MH",
  Manipur: "MN",
  Meghalaya: "ML",
  Mizoram: "MZ",
  Nagaland: "NL",
  Odisha: "OR",
  Punjab: "PB",
  Rajasthan: "RJ",
  Sikkim: "SK",
  "Tamil Nadu": "TN",
  Telangana: "TG",
  Tripura: "TR",
  "Uttar Pradesh": "UP",
  Uttarakhand: "UK",
  "West Bengal": "WB",
  "Andaman and Nicobar Islands": "AN",
  Chandigarh: "CH",
  "Dadra and Nagar Haveli and Daman and Diu": "DH",
  Delhi: "DL",
  "Jammu and Kashmir": "JK",
  Ladakh: "LA",
  Lakshadweep: "LD",
  Puducherry: "PY",
};

const IN_STATE_CODE_TO_NAME = Object.entries(IN_STATE_NAME_TO_CODE).reduce((acc, [name, code]) => {
  acc[code] = name;
  return acc;
}, {} as Record<string, string>);

function toTerritoryCode(country: string) {
  const value = String(country || "").trim();
  if (!value) return "";
  if (value.length === 2) return value.toUpperCase();
  if (value.toLowerCase() === "india") return "IN";
  return value.toUpperCase();
}

function toZoneCode(countryCode: string, province: string) {
  const normalizedCountry = String(countryCode || "").toUpperCase();
  const rawProvince = String(province || "").trim();
  if (!rawProvince) return "";
  if (normalizedCountry === "IN") {
    return IN_STATE_NAME_TO_CODE[rawProvince] || rawProvince;
  }
  return rawProvince;
}

function fromZoneCode(countryCode: string, zoneCode: string) {
  const normalizedCountry = String(countryCode || "").toUpperCase();
  const rawZone = String(zoneCode || "").trim();
  if (!rawZone) return "";
  if (normalizedCountry === "IN") {
    return IN_STATE_CODE_TO_NAME[rawZone] || rawZone;
  }
  return rawZone;
}

function countryLabel(countryCode: string) {
  const normalized = String(countryCode || "").toUpperCase();
  if (normalized === "IN") return "India";
  return normalized || "";
}

function toDisplayName(firstName: string, lastName: string, name: string) {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  return name || "";
}

function splitName(name: string): { firstName: string; lastName: string } {
  const value = String(name || "").trim().replace(/\s+/g, " ");
  if (!value) return { firstName: "", lastName: "" };
  const parts = value.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

function decodeJwtPayload(token: string): UserInfoPayload | null {
  const raw = String(token || "").trim();
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length < 2) return null;

  try {
    const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
    const json = JSON.parse(decoded) as UserInfoPayload;
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

export function extractProfileFromIdToken(idToken: string): {
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
} | null {
  const payload = decodeJwtPayload(idToken);
  if (!payload) return null;

  const email = String(payload.email || "").trim();
  const givenName = String(payload.given_name || "").trim();
  const familyName = String(payload.family_name || "").trim();
  const fullName = String(payload.name || "").trim();
  const split = splitName(fullName);
  const firstName = givenName || split.firstName;
  const lastName = familyName || split.lastName;
  const phone = String(payload.phone_number || "").trim();

  if (!email && !firstName && !lastName && !fullName && !phone) return null;
  return { email, firstName, lastName, name: fullName, phone };
}

let customerAccountApiEndpointCache: string | null = null;

async function getCustomerAccountGraphqlEndpoint() {
  if (customerAccountApiEndpointCache) return customerAccountApiEndpointCache;
  const shopDomain = String(process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_URL || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .split("/")[0];
  if (!shopDomain) {
    throw new Error("Missing SHOPIFY_STORE_DOMAIN for Customer Account API discovery.");
  }

  const discovery = await fetch(`https://${shopDomain}/.well-known/customer-account-api`, { cache: "no-store" });
  if (!discovery.ok) {
    throw new Error("Unable to discover Customer Account API endpoint.");
  }
  const discoveryJson = (await discovery.json()) as { graphql_api?: string };
  const graphqlEndpoint = String(discoveryJson?.graphql_api || "").trim();
  if (!graphqlEndpoint) {
    throw new Error("Customer Account API discovery did not return graphql_api.");
  }
  customerAccountApiEndpointCache = graphqlEndpoint;
  return graphqlEndpoint;
}

async function customerAccountGraphql<TData>(
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const graphqlEndpoint = await getCustomerAccountGraphqlEndpoint();
  const response = await fetch(graphqlEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const json = (await response.json()) as {
    data?: TData;
    errors?: Array<{ message?: string }>;
  };
  if (!response.ok || (Array.isArray(json.errors) && json.errors.length > 0)) {
    const msg = Array.isArray(json.errors) && json.errors[0]?.message
      ? String(json.errors[0].message)
      : "Customer Account API request failed.";
    throw new Error(msg);
  }
  if (!json?.data) {
    throw new Error("Customer Account API returned an empty response.");
  }
  return json.data;
}

export async function fetchCustomerFromCustomerAccountToken(accessToken: string): Promise<FirebaseAuthenticatedCustomer> {
  const query = `query CustomerIdentity {
    customer {
      id
      firstName
      lastName
      displayName
      emailAddress { emailAddress }
      phoneNumber { phoneNumber }
      defaultAddress {
        id
      }
      addresses(first: 20) {
        nodes {
          id
          firstName
          lastName
          company
          address1
          address2
          city
          zoneCode
          territoryCode
          zip
          phoneNumber
        }
      }
      orders(first: 50, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          name
          number
          processedAt
          fulfillmentStatus
          financialStatus
          totalPrice {
            amount
            currencyCode
          }
          lineItems(first: 50) {
            nodes {
              id
              name
              quantity
              variantTitle
              price {
                amount
                currencyCode
              }
              image {
                url
                altText
              }
            }
          }
        }
      }
    }
  }`;
  const data = await customerAccountGraphql<{
    customer?: {
      id?: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      emailAddress?: { emailAddress?: string };
      phoneNumber?: { phoneNumber?: string };
      defaultAddress?: { id?: string };
      addresses?: { nodes?: Array<Record<string, any>> };
      orders?: { nodes?: Array<Record<string, any>> };
    };
  }>(accessToken, query);

  const customer = data?.customer;
  if (!customer?.id) {
    throw new Error("Customer profile is unavailable.");
  }

  let firstName = String(customer.firstName || "").trim();
  let lastName = String(customer.lastName || "").trim();
  const rawDisplayName = String(customer.displayName || "").trim();

  // If Shopify Customer Account profile only has a display name (common with Google sign-in),
  // derive first/last name so account screens can prefill the profile form.
  if ((!firstName && !lastName) && rawDisplayName) {
    const split = splitName(rawDisplayName);
    firstName = split.firstName;
    lastName = split.lastName;
  }

  const displayName = toDisplayName(firstName, lastName, rawDisplayName);
  const email = String(customer.emailAddress?.emailAddress || "").trim();
  const id = String(customer.id || "").trim() || `shopify-ca:${email || "customer"}`;

  const addressNodes = Array.isArray(customer.addresses?.nodes) ? customer.addresses!.nodes! : [];
  const addresses = addressNodes.map((node, idx) => {
    const territoryCode = String(node?.territoryCode || "").trim();
    const zoneCode = String(node?.zoneCode || "").trim();
    return {
      id: String(node?.id || `${id}-address-${idx}`),
      firstName: String(node?.firstName || ""),
      lastName: String(node?.lastName || ""),
      company: String(node?.company || ""),
      address1: String(node?.address1 || ""),
      address2: String(node?.address2 || ""),
      city: String(node?.city || ""),
      province: fromZoneCode(territoryCode, zoneCode),
      country: countryLabel(territoryCode),
      zip: String(node?.zip || ""),
      phone: String(node?.phoneNumber || ""),
    };
  });

  const orderNodes = Array.isArray(customer.orders?.nodes) ? customer.orders!.nodes! : [];

  const orders = orderNodes.map((orderNode, orderIdx) => {
    const name = String(orderNode?.name || "");
    const number = Number(orderNode?.number ?? 0);
    const processedAt = String(orderNode?.processedAt || "");
    const fulfillmentStatus = String(orderNode?.fulfillmentStatus || "UNFULFILLED");
    const financialStatus = String(orderNode?.financialStatus || "PENDING");

    const totalPrice = orderNode?.totalPrice || {};
    const totalAmount = String(totalPrice?.amount ?? "0.00");
    const totalCurrency = String(totalPrice?.currencyCode ?? "INR");

    const lineItemsNodes = Array.isArray(orderNode?.lineItems?.nodes) ? orderNode.lineItems.nodes : [];
    const lineItems = lineItemsNodes.map((li: any, idx: number) => {
      const priceMoney = li?.price || {};
      const priceAmount = String(priceMoney?.amount ?? totalAmount);
      const priceCurrency = String(priceMoney?.currencyCode ?? totalCurrency);
      const image = li?.image || {};

      return {
        id: String(li?.id || `${orderNode?.id || "order"}-line-${idx}`),
        title: String(li?.name || "Product"),
        quantity: Number(li?.quantity || 1),
        variantTitle: String(li?.variantTitle || ""),
        productHandle: "",
        image: String(image?.url || ""),
        imageAlt: undefined,
        price: {
          amount: priceAmount,
          currencyCode: priceCurrency,
        },
      };
    });

    return {
      id: String(orderNode?.id || `order-${orderIdx}`),
      orderNumber: number,
      processedAt,
      fulfillmentStatus,
      financialStatus,
      lineItems,
      totalPrice: {
        amount: totalAmount,
        currencyCode: totalCurrency,
      },
    };
  });

  return {
    id,
    firstName,
    lastName,
    displayName,
    email,
    phone: customer?.phoneNumber?.phoneNumber ? String(customer.phoneNumber.phoneNumber) : null,
    defaultAddressId: customer?.defaultAddress?.id ? String(customer.defaultAddress.id) : null,
    addresses,
    orders,
  };
}

type CustomerAccountAddressInput = {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  zoneCode?: string;
  territoryCode?: string;
  zip?: string;
  phoneNumber?: string;
};

function toCustomerAccountAddressInput(input: {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
  phone?: string;
}): CustomerAccountAddressInput {
  const territoryCode = toTerritoryCode(String(input.country || "IN"));
  return {
    firstName: String(input.firstName || "").trim() || undefined,
    lastName: String(input.lastName || "").trim() || undefined,
    company: String(input.company || "").trim() || undefined,
    address1: String(input.address1 || "").trim() || undefined,
    address2: String(input.address2 || "").trim() || undefined,
    city: String(input.city || "").trim() || undefined,
    zoneCode: toZoneCode(territoryCode, String(input.province || "")),
    territoryCode: territoryCode || undefined,
    zip: String(input.zip || "").trim() || undefined,
    phoneNumber: String(input.phone || "").trim() || undefined,
  };
}

export async function customerAccountAddressCreate(
  accessToken: string,
  input: Parameters<typeof toCustomerAccountAddressInput>[0],
  defaultAddress = false
) {
  const mutation = `mutation CustomerAddressCreate($address: CustomerAddressInput!, $defaultAddress: Boolean) {
    customerAddressCreate(address: $address, defaultAddress: $defaultAddress) {
      customerAddress { id }
      userErrors { field message code }
    }
  }`;

  const data = await customerAccountGraphql<{
    customerAddressCreate?: { customerAddress?: { id?: string }; userErrors?: Array<{ message?: string }> };
  }>(accessToken, mutation, { address: toCustomerAccountAddressInput(input), defaultAddress });

  const payload = data?.customerAddressCreate;
  const userErrors = Array.isArray(payload?.userErrors)
    ? payload!.userErrors!.map((error) => String(error?.message || "").trim()).filter(Boolean)
    : [];

  return { addressId: payload?.customerAddress?.id ? String(payload.customerAddress.id) : null, userErrors };
}

export async function customerAccountAddressUpdate(
  accessToken: string,
  addressId: string,
  input: Parameters<typeof toCustomerAccountAddressInput>[0],
  defaultAddress?: boolean
) {
  const mutation = `mutation CustomerAddressUpdate($addressId: ID!, $address: CustomerAddressInput, $defaultAddress: Boolean) {
    customerAddressUpdate(addressId: $addressId, address: $address, defaultAddress: $defaultAddress) {
      customerAddress { id }
      userErrors { field message code }
    }
  }`;

  const data = await customerAccountGraphql<{
    customerAddressUpdate?: { customerAddress?: { id?: string }; userErrors?: Array<{ message?: string }> };
  }>(accessToken, mutation, {
    addressId,
    address: Object.keys(input || {}).length > 0 ? toCustomerAccountAddressInput(input) : undefined,
    defaultAddress,
  });

  const payload = data?.customerAddressUpdate;
  const userErrors = Array.isArray(payload?.userErrors)
    ? payload!.userErrors!.map((error) => String(error?.message || "").trim()).filter(Boolean)
    : [];

  return { addressId: payload?.customerAddress?.id ? String(payload.customerAddress.id) : null, userErrors };
}

export async function customerAccountAddressDelete(accessToken: string, addressId: string) {
  const mutation = `mutation CustomerAddressDelete($addressId: ID!) {
    customerAddressDelete(addressId: $addressId) {
      deletedAddressId
      userErrors { field message code }
    }
  }`;

  const data = await customerAccountGraphql<{
    customerAddressDelete?: { deletedAddressId?: string; userErrors?: Array<{ message?: string }> };
  }>(accessToken, mutation, { addressId });

  const payload = data?.customerAddressDelete;
  const userErrors = Array.isArray(payload?.userErrors)
    ? payload!.userErrors!.map((error) => String(error?.message || "").trim()).filter(Boolean)
    : [];

  return { deletedAddressId: payload?.deletedAddressId ? String(payload.deletedAddressId) : null, userErrors };
}
