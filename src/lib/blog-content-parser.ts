// Parses author-pasted blog HTML that carries metadata in comments
// at the top of the document, for example:
//
//   <!-- SEO title : Some proper title -->
//   <!-- SeO Description : An excerpt -->
//   <!-- Title : The real title -->
//   <!-- Excerpt : detail -->
//   <!-- Tags : tagOne,Tag Two -->
//   ... body ...
//
// Also supports the `//Key : value` ASCII-comment style and a
// `//heroImage: https://...` directive. The body HTML returned here
// has those metadata lines removed so the editor starts clean.

export type ParsedBlogContent = {
  title: string
  excerpt: string
  seoTitle: string
  seoDescription: string
  tags: string[]
  contentHtml: string
  heroImage?: string
  hadMetadata: boolean
}

/** Keys we recognize, in the order we prefer when more than one is present. */
const KEY_ALIASES: Array<{ keys: string[]; field: keyof Pick<ParsedBlogContent, "title" | "excerpt" | "seoTitle" | "seoDescription" | "tags" | "heroImage"> }> = [
  { keys: ["title"], field: "title" },
  { keys: ["excerpt"], field: "excerpt" },
  { keys: ["seo title", "seo-title", "seotitle", "seo_title"], field: "seoTitle" },
  { keys: ["seo description", "seo-description", "seodescription", "seo_description"], field: "seoDescription" },
  { keys: ["tags"], field: "tags" },
  { keys: ["hero image", "heroimage", "hero-image", "hero_image", "heroph"], field: "heroImage" },
]

/** Normalizes a key string to a canonical lowercase "slug" we can match against. */
function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ")
}

/**
 * Tries to interpret `line` as a metadata directive.
 * Returns `{ field, value }` when it matches a known key, otherwise null.
 *
 * Accepted forms:
 *   <!-- Key : value -->
 *   <!--Key: value-->
 *   //Key : value
 *   Key : value            (only when line looks like a lone directive at the top)
 */
function parseDirectiveLine(line: string): { field: string; value: string } | null {
  // Strip a wrapping HTML comment: <!-- ... -->
  let content = line.trim()
  if (/^<!--\s*/i.test(content) && /--\s*>$/i.test(content)) {
    content = content.replace(/^<!--\s*/i, "").replace(/\s*-->\s*$/i, "").trim()
  }

  // Now accept both `Key : value` and `Key: value`
  const colonIdx = content.indexOf(":")
  if (colonIdx <= 0) return null
  const key = normalizeKey(content.slice(0, colonIdx))
  const value = content.slice(colonIdx + 1).trim()
  if (!value) return null

  for (const { keys, field } of KEY_ALIASES) {
    if (keys.some((k) => normalizeKey(k) === key)) {
      return { field, value }
    }
  }
  return null
}

/**
 * Extracts `<img src="...">` candidates from HTML.
 * Returns the first `src` found, or undefined.
 */
function extractFirstImageSrc(html: string): string | undefined {
  const srcMatch = html.match(/<img[^>]+src\s*=\s*["']([^"'>]+)["']/i)
  return srcMatch ? srcMatch[1] : undefined
}

/**
 * Fallback title: the first `<h1>` (or `<title>`) text in the pasted HTML.
 *
 * Used only when there is no `Title` metadata comment, so a pasted article
 * that forgot the comment still gets a title — and therefore a slug — instead
 * of an empty form.
 */
function extractFirstHeadingText(html: string): string | undefined {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return undefined
  const text = String(match[1])
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
  return text || undefined
}

/**
 * Strips metadata comment lines from the body HTML.
 *
 * We treat any line that looks like a `<!-- ... -->` or `// ...` directive
 * and that contains a recognizable metadata key as a metadata line, and drop it.
 * This is intentionally conservative: if a line is ambiguous we keep it so
 * we never silently eat blog body content.
 */
function stripMetadataLines(html: string, detectedKeys: Set<string>): string {
  if (!html) return html
  const lines = html.split(/\r?\n/)
  const kept: string[] = []
  const canonical = new Set(
    Array.from(detectedKeys).map((k) => normalizeKey(k)),
  )

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      kept.push(line)
      continue
    }

    // Does this line look like a directive at all?
    const looksLikeDirective =
      /^<!--\s*[^>]+-->\s*$/i.test(trimmed) ||
      /^\/\/\s*[^\s:].*:/i.test(trimmed) ||
      /^[A-Za-z][A-Za-z0-9_-]*\s*:\s*\S/i.test(trimmed)

    if (!looksLikeDirective) {
      kept.push(line)
      continue
    }

    const parsed = parseDirectiveLine(line)
    if (!parsed) {
      // Directive-ish but not one we know — keep it to be safe.
      kept.push(line)
      continue
    }

    if (canonical.has(normalizeKey(parsed.field))) {
      // Recognized metadata line — drop it.
      continue
    }

    // Directive with an unknown key — keep it.
    kept.push(line)
  }

  return kept.join("\n")
}

/**
 * Extracts `title`, `excerpt`, `seoTitle`, `seoDescription`, `tags`, and an
 * optional `heroImage` from the top-of-document metadata block.
 */
export function parseBlogContent(html: string): ParsedBlogContent {
  const input = html || ""
  const detected: Record<string, string> = {}
  const detectedKeys = new Set<string>()

  // Split into candidate metadata lines (top of document) and body.
  // We scan line-by-line and treat the leading run of directive-looking
  // lines as metadata; once we hit a line that is clearly "body content"
  // (e.g. an HTML tag that is not a comment), we stop treating subsequent
  // lines as metadata candidates. This avoids mis-parsing inline `<!-- -->`
  // comments that happen to contain a colon deeper in the body.
  const lines = input.split(/\r?\n/)
  const bodyStartIndex = lines.findIndex((line) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    // A "body" line is an HTML tag that is not clearly a comment directive.
    const isHtmlTag = /<[a-z][^>]*>/i.test(trimmed) || /<\?[a-z]/i.test(trimmed)
    const isCommentDirective = /^<!--\s*[^>]+-->\s*$/i.test(trimmed) || /^\/\/\s*[^\s:].*:/i.test(trimmed)
    return isHtmlTag && !isCommentDirective
  })

  const candidateLines = bodyStartIndex >= 0 ? lines.slice(0, bodyStartIndex) : lines

  for (const line of candidateLines) {
    const parsed = parseDirectiveLine(line)
    if (!parsed) continue
    if (parsed.field in detected) continue // first occurrence wins
    detected[parsed.field] = parsed.value
    detectedKeys.add(parsed.field)
  }

  const norm = (v: string) => v.trim()

  const title = norm(detected["title"] || "") || norm(extractFirstHeadingText(input) || "")
  const excerpt = norm(detected["excerpt"] || "")
  const seoTitle = norm(detected["seo title"] || "")
  const seoDescription = norm(detected["seo description"] || "")
  const rawTags = norm(detected["tags"] || "")

  // Tags arrive as a comma-separated list; normalize into the app's expected
  // `["tag1", "tag2"]` shape. Preserve the original casing but trim.
  const tags: string[] = rawTags
    ? rawTags.split(",").map((t) => t.trim()).filter(Boolean)
    : []

  // Build the cleaned body by removing the metadata lines we consumed.
  let contentHtml = stripMetadataLines(input, detectedKeys)

  // Optional hero image: if a `heroImage` directive was present, use it.
  // Otherwise, if the body contains an `<img>` and no explicit directive, we
  // surface the first image src as a *suggested* hero (not forced).
  const heroImageFromDirective = norm(detected["hero image"] || "")
  let heroImage: string | undefined
  if (heroImageFromDirective) {
    heroImage = heroImageFromDirective
  } else {
    // Suggest the first <img> src when we recognised this paste as an article
    // — either metadata comments were present, or we fell back to an
    // <h1>/<title> heading for the title. Never force it: the modal shows the
    // suggestion with an opt-out checkbox.
    if (detectedKeys.size > 0 || title) {
      const firstImg = extractFirstImageSrc(input)
      if (firstImg) heroImage = firstImg
    }
  }

  // Normalize the cleaned body a little: collapse a leading/trailing blank
  // run that the strip may have left behind.
  contentHtml = contentHtml.replace(/^\s+/, "").replace(/\s+$/, "")

  const hadMetadata = detectedKeys.size > 0

  return {
    title,
    excerpt,
    seoTitle: seoTitle || title,
    seoDescription: seoDescription || excerpt || "",
    tags,
    contentHtml: contentHtml || "<p></p>",
    heroImage,
    hadMetadata,
  }
}

export function hasMetadataDirective(html: string): boolean {
  return parseBlogContent(html).hadMetadata
}

