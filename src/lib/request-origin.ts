import { SITE_URL } from "@/lib/seo";

// The storefront and collection pages are intentionally static and revalidate on
// a schedule. Reading request headers here would make them dynamic at runtime and
// re-trigger the "Page changed from static to dynamic" warning. Use the fixed
// public origin instead so all internal fetches remain static-safe.
export async function getRequestOrigin(): Promise<string> {
  return SITE_URL;
}
