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

/** Blocks obvious SSRF targets — admin-only endpoint, but defense in depth. */
function isUnsafeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/**
 * Best-effort content-type check. HEAD first; some hosts reject HEAD, so fall
 * back to a 1-byte ranged GET. Returns "" when the URL is unreachable.
 */
async function probeImageContentType(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (res.ok) return (res.headers.get("content-type") || "").toLowerCase();
  } catch {
    /* fall through to ranged GET */
  }
  try {
    const res = await fetch(url, {
      headers: { Range: "bytes=0-0" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok || res.status === 206) return (res.headers.get("content-type") || "").toLowerCase();
  } catch {
    /* unreachable */
  }
  return "";
}

function filenameFromUrl(url: string, contentType: string): string {
  let name = "";
  try {
    name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
  } catch {
    name = "";
  }
  name = name
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
    let ext = "jpg";
    if (contentType.startsWith("image/")) {
      ext = contentType.split("/")[1].split(";")[0].replace("jpeg", "jpg").replace("svg+xml", "svg");
    }
    name = `${name || "external-image"}.${ext}`;
  }
  return name || "external-image.jpg";
}

/**
 * JSON branch of POST: register an externally-hosted image (any public URL)
 * in the media library without uploading it. Validation happens server-side
 * because a browser-side HEAD probe is blocked by CORS for most hosts.
 */
async function handleUrlUpload(request: Request, session: { email?: string }): Promise<Response> {
  let payload: { url?: unknown; altText?: unknown } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawUrl = String(payload.url || "").trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Enter a valid URL (including https://)" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) URLs are supported" }, { status: 400 });
  }
  if (isUnsafeHost(parsed.hostname)) {
    return NextResponse.json({ error: "That host is not allowed" }, { status: 400 });
  }

  const url = parsed.toString();
  const contentType = await probeImageContentType(url);
  const looksLikeImageExt = /\.(jpe?g|png|webp|gif|avif|svg|bmp|ico)(\?|#|$)/i.test(parsed.pathname);

  if (!contentType && !looksLikeImageExt) {
    return NextResponse.json(
      { error: "Could not fetch that URL — check the link works in a browser first" },
      { status: 400 },
    );
  }
  const typeLooksWrong =
    contentType !== "" &&
    !contentType.startsWith("image/") &&
    !(contentType === "application/octet-stream" && looksLikeImageExt);
  if (typeLooksWrong) {
    return NextResponse.json({ error: "That URL does not point to an image" }, { status: 400 });
  }

  const filename = filenameFromUrl(url, contentType);
  const altText =
    String(payload.altText || "").trim() ||
    filename.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_]+/g, " ").trim() ||
    "External image";

  const db = getFirebaseDb();
  const docRef = db.collection("media").doc();
  const record: Record<string, unknown> = {
    url,
    altText,
    filename,
    uploadedAt: new Date().toISOString(),
    uploadedBy: session.email || "",
    storage: "external",
  };
  await docRef.set(record);
  return NextResponse.json({ ok: true, media: { id: docRef.id, ...record } });
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

    if (contentType.includes("application/json")) {
      return await handleUrlUpload(request, session)
    }

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