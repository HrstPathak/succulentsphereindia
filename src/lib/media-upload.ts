import "server-only";

import { getFirebaseStorage } from "@/lib/firebase-admin";

function extractUrl(payload: unknown): string {
  const candidates: string[] = []
  function walk(value: unknown): void {
    if (!value || typeof value !== "object") return
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry)
      return
    }
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (typeof val === "string" && val.trim()) {
        const trimmed = val.trim()
        if (["url", "imageUrl", "secure_url", "src", "link", "download_url", "file_url"].includes(key)) candidates.push(trimmed)
        else if ((key === "path" || key === "location") && /[^/]+\.[a-z0-9]{2,5}$/i.test(trimmed)) candidates.push(trimmed)
        else if ((key === "filename" || key === "name") && /[^/]+\.[a-z0-9]{2,5}$/i.test(trimmed)) candidates.push(trimmed)
      } else if (val && typeof val === "object") walk(val)
    }
  }
  walk(payload)
  return candidates.find((url) => url.startsWith("http") || url.includes("/")) || ""
}

function extractFilename(payload: unknown): string {
  let found = ""
  function walk(value: unknown): void {
    if (!value || typeof value !== "object") return
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry)
      return
    }
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (typeof val === "string" && val.trim() && ["filename", "name", "file_name"].includes(key)) found = val.trim()
      else if (val && typeof val === "object") walk(val)
    }
  }
  walk(payload)
  return found
}

/** Primary: upload to the configured Hostinger endpoint. Throws with a diagnosable message on failure. */
async function uploadToHostinger(file: File, dir: string): Promise<string> {
  const endpoint = String(process.env.HOSTINGER_UPLOAD_URL || "").trim()
  const token = String(process.env.HOSTINGER_UPLOAD_TOKEN || "").trim()

  const form = new FormData()
  form.append("file", file, file.name || "media-image")
  if (token) form.append("token", token)
  form.append("path", dir)

  const response = await fetch(endpoint, {
    method: "POST",
    body: form,
    cache: "no-store",
    // Don't let a dead/unreachable endpoint hang the request — fall back quickly.
    signal: AbortSignal.timeout(15000),
  })
  const rawText = await response.text()
  let payload: any = null
  try {
    payload = rawText ? JSON.parse(rawText) : null
  } catch {
    payload = null
  }

  const mediaBase = String(
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://whitesmoke-cattle-754161.hostingersite.com",
  ).replace(/\/+$/, "")

  const directUrl = extractUrl(payload)
  if (response.ok && directUrl) {
    return directUrl.startsWith("http") ? directUrl : `${mediaBase}/${directUrl.replace(/^\/+/, "")}`
  }

  if (response.ok) {
    const filename = extractFilename(payload)
    if (filename) {
      return `${mediaBase}/${dir.replace(/^\/+/, "")}/${filename.replace(/^\/+/, "")}`
    }
  }

  const detail =
    String(payload?.error || payload?.message || "").trim() ||
    (rawText ? rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) : "") ||
    ""
  throw new Error(`${endpoint} returned HTTP ${response.status}${detail ? ` — ${detail}` : ""}`)
}

/** Fallback: upload to Firebase Storage (already configured via firebase-admin) and make it public. */
async function uploadToFirebaseStorage(file: File, dir: string): Promise<string> {
  const bucket = getFirebaseStorage().bucket()
  const safeName =
    String(file.name || "image")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .slice(-120) || "image"
  const objectPath = `${dir.replace(/^\/+|\/+$/g, "")}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const blob = bucket.file(objectPath)
  await blob.save(buffer, {
    contentType: file.type || "application/octet-stream",
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000, immutable" },
  })
  await blob.makePublic()
  return `https://storage.googleapis.com/${bucket.name}/${objectPath}`
}

export async function uploadMediaFile(file: File, subdir = "blog"): Promise<string> {
  const baseDir = String(process.env.HOSTINGER_UPLOAD_DIR || "sites/images")
    .trim()
    .replace(/^\/+|\/+$/g, "")
  const dir = `${baseDir}/${subdir}`.replace(/\/+/g, "/")

  const failures: string[] = []

  // 1. Try the configured Hostinger upload endpoint first (existing behaviour).
  const endpoint = String(process.env.HOSTINGER_UPLOAD_URL || "").trim()
  if (endpoint) {
    try {
      return await uploadToHostinger(file, dir)
    } catch (error) {
      const reason = (error as Error).message || String(error)
      failures.push(`Hostinger (${endpoint}): ${reason}`)
      console.error("[media-upload] Hostinger upload failed, falling back to Firebase Storage:", reason)
    }
  }

  // 2. Fall back to Firebase Storage so uploads never hard-fail while the
  //    Hostinger endpoint is unreachable / misconfigured.
  try {
    return await uploadToFirebaseStorage(file, dir)
  } catch (error) {
    failures.push(`Firebase Storage: ${(error as Error).message || String(error)}`)
  }

  if (!endpoint) {
    failures.unshift(
      "Hostinger: HOSTINGER_UPLOAD_URL is not configured on the server environment",
    )
  }

  throw new Error(`Image upload failed — ${failures.join(" | ")}`)
}