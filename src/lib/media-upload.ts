import "server-only";

export async function uploadMediaFile(file: File, subdir = "blog"): Promise<string> {
  const endpoint = String(process.env.HOSTINGER_UPLOAD_URL || "").trim()
  const token = String(process.env.HOSTINGER_UPLOAD_TOKEN || "").trim()
  if (!endpoint) throw new Error("HOSTINGER_UPLOAD_URL is not configured")

  const form = new FormData()
  form.append("file", file, file.name || "media-image")
  if (token) form.append("token", token)
  const baseDir = String(process.env.HOSTINGER_UPLOAD_DIR || "sites/images").trim().replace(/\/+$/, "")
  const dir = `${baseDir}/${subdir}`.replace(/\/+/g, "/")
  form.append("path", dir)

  const response = await fetch(endpoint, { method: "POST", body: form, cache: "no-store" })
  const rawText = await response.text()
  let payload: any = null
  try {
    payload = rawText ? JSON.parse(rawText) : null
  } catch {
    payload = null
  }

  const mediaBase = String(
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://whitesmoke-cattle-754161.hostingersite.com"
  ).replace(/\/+$/, "")

  const directUrl = String(payload?.url || payload?.imageUrl || payload?.data?.url || payload?.path || "").trim()
  if (response.ok && directUrl) {

    return directUrl.startsWith("http") ? directUrl : `${mediaBase}/${directUrl.replace(/^\/+/, "")}`
  }
  if (response.ok && typeof payload?.filename === "string") {
    return `${mediaBase}/${dir.replace(/^\/+/, "")}/${payload.filename.replace(/^\/+/, "")}`
  }
  throw new Error(payload?.error || payload?.message || `Media upload failed (${response.status})`)
}