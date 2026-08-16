import { generateAndCache } from "@/lib/metaFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/meta/catalog/generate
 * Protected by META_GENERATE_SECRET env var. Can be called by a scheduler or a Firestore trigger.
 */
export async function POST(request: Request) {
  const secret = String(process.env.META_GENERATE_SECRET || "").trim();
  // Allow secret in Authorization: Bearer <secret> or ?secret= in query for convenience.
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const url = new URL(request.url);
  const q = url.searchParams.get("secret") || "";
  if (!secret) {
    return new Response("META_GENERATE_SECRET not configured", { status: 500 });
  }
  if (!(bearer === secret || q === secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const siteOrigin = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim() || new URL(request.url).origin;
  try {
    const result = await generateAndCache(siteOrigin);
    if (result.ok) {
      return new Response(JSON.stringify({ ok: true, source: result.source }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: false, error: result.error }), { status: 500, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
