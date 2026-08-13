import { headers } from "next/headers";
import { SITE_URL } from "@/lib/seo";

function normalizeForwardedValue(value: string | null): string {
  return value?.split(",")[0]?.trim() || "";
}

function isLocalHost(host: string): boolean {
  const normalizedHost = host.toLowerCase();
  return (
    normalizedHost.startsWith("localhost") ||
    normalizedHost.startsWith("127.0.0.1") ||
    normalizedHost.startsWith("[::1]")
  );
}

export async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    normalizeForwardedValue(requestHeaders.get("x-forwarded-host")) ||
    normalizeForwardedValue(requestHeaders.get("host"));

  if (!host) {
    return SITE_URL;
  }

  const protocol =
    normalizeForwardedValue(requestHeaders.get("x-forwarded-proto")) ||
    (isLocalHost(host) ? "http" : "https");

  return `${protocol}://${host}`;
}
