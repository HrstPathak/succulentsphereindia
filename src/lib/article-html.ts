export function sanitizeArticleHtml(value: string): string {
  return String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    // Below-the-fold article/description images (raw HTML rendered via
    // dangerouslySetInnerHTML) used to download eagerly on page load. Inject
    // native lazy-loading on every <img> that doesn't already set it — the
    // browser then only fetches images as they approach the viewport.
    .replace(/<img\b(?![^>]*\bloading\s*=)([^>]*)>/gi, '<img loading="lazy" decoding="async" $1>');
}
