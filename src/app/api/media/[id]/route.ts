import { NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase-admin";

/**
 * GET /api/media/[id]
 * Public binary passthrough for images stored inside Firestore (fallback used
 * when the external Hostinger upload endpoint is unavailable). Media documents
 * are immutable, so the response can be cached forever.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const snap = await getFirebaseDb().collection("media").doc(id).get();
    if (!snap.exists) {
      return new NextResponse("Not found", { status: 404 });
    }
    const data = snap.data() as Record<string, unknown> | undefined;

    // Inline Firestore-stored binary
    if (typeof data?.data === "string" && data.data) {
      const buffer = Buffer.from(data.data, "base64");
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": String(data.contentType || "image/jpeg"),
          "Content-Length": String(buffer.length),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Records uploaded externally — redirect to their URL
    const externalUrl = String(data?.url || "");
    if (externalUrl && /^https?:\/\//.test(externalUrl)) {
      return NextResponse.redirect(externalUrl, 302);
    }

    return new NextResponse("Not found", { status: 404 });
  } catch (error) {
    console.error("[media] failed to serve media:", (error as Error).message);
    return new NextResponse("Server error", { status: 500 });
  }
}