import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { uploadMediaFile } from "@/lib/media-upload";

const AUTH_ERROR = "ADMIN_REQUIRED";

function authStatus(error: unknown): number {
  return String((error as Error).message) === AUTH_ERROR ? 404 : 500;
}

function authMessage(error: unknown, fallback: string): string {
  return String((error as Error).message) === AUTH_ERROR
    ? "Not found."
    : String((error as Error).message || error) || fallback;
}

export async function GET(request: Request) {
  try {
    await requireAdmin()
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get("limit")) || 60, 200)

    const snapshot = await getFirebaseDb()
      .collection("media")
      .orderBy("uploadedAt", "desc")
      .limit(limit)
      .get()

    const items = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        url: String(data.url || ""),
        altText: String(data.altText || ""),
        filename: String(data.filename || ""),
        uploadedAt: String(data.uploadedAt || ""),
      }
    })

    return NextResponse.json({ ok: true, items })
  } catch (error) {
    return NextResponse.json({ error: authMessage(error, "Unable to load media.") }, { status: authStatus(error) })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    const contentType = request.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 })
    }

    const form = await request.formData()
    const file = form.get("file")
    const altText = String(form.get("altText") || "")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const MAX_INLINE_BYTES = 700_000;
    let externalUrl = "";
    let inlineData = "";
    let inlineContentType = "";

    try {
      externalUrl = await uploadMediaFile(file, "blog");
    } catch (uploadError) {
      // External (Hostinger) upload endpoint is unavailable/misconfigured —
      // store the image inside Firestore instead so uploads still work.
      console.error(
        "[admin/media] external upload failed, falling back to Firestore storage:",
        (uploadError as Error).message,
      );
      if (file.size > MAX_INLINE_BYTES) {
        return NextResponse.json(
          {
            error:
              "Image is larger than 700 KB and the external upload service is unavailable — please choose a smaller image.",
          },
          { status: 413 },
        );
      }
      inlineData = Buffer.from(await file.arrayBuffer()).toString("base64");
      inlineContentType = file.type || "image/jpeg";
    }

    const db = getFirebaseDb();
    const docRef = db.collection("media").doc();
    const record: Record<string, unknown> = {
      url: externalUrl || `/api/media/${docRef.id}`,
      altText,
      filename: file.name || "",
      uploadedAt: new Date().toISOString(),
      uploadedBy: session.email || "",
    };
    if (!externalUrl) {
      record.storage = "firestore";
      record.data = inlineData;
      record.contentType = inlineContentType;
      record.size = file.size;
    }
    await docRef.set(record);
    return NextResponse.json({ ok: true, media: { id: docRef.id, ...record } });
  } catch (error) {
    const message = authMessage(error, "Upload failed")
    // Show the real root cause in server logs so 500s are diagnosable
    if (String((error as Error).message) !== AUTH_ERROR) {
      console.error("[admin/media] upload failed:", message)
    }
    const status = String((error as Error).message) === AUTH_ERROR
      ? 404
      : Number((error as any)?.status) || 500
    return NextResponse.json({ error: message }, { status })
  }
}